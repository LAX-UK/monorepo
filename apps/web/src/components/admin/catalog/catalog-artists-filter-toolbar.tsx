"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import {
  CatalogFilterBar,
  type CatalogSegmentItem,
} from "@/components/admin/catalog/catalog-filter-bar";
import { FilterCheckboxGroup } from "@/components/ui/filter-checkbox-group";
import { FilterSelect } from "@/components/ui/filter-select";
import { creatorKindConfigList } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const KIND_FILTER_OPTIONS = [
  { value: "", label: "Any" },
  ...creatorKindConfigList.map((c) => ({ value: c.kind, label: c.label })),
];

export type ArtistCategoryFilterOption = { value: string; label: string };

const inputCls = "h-10 w-full font-body text-sm";
const selectCls = "h-10 w-full font-body text-sm";
const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

type FilterDefaults = {
  q?: string | null | undefined;
  status?: string | null | undefined;
  kind?: string | null | undefined;
  categoryId?: string | null | undefined;
  country?: string | null | undefined;
  sort?: string | null | undefined;
  featured?: boolean | null | undefined;
  verified?: boolean | null | undefined;
  includeArchived?: boolean | null | undefined;
  linked?: "any" | "yes" | "no" | null | undefined;
};

function ArtistRegistryFilterForm({
  defaults,
  categoryOptions = [],
}: {
  defaults: FilterDefaults;
  categoryOptions?: readonly ArtistCategoryFilterOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const params = new URLSearchParams(searchParams.toString());
          params.set("offset", "0");
          params.delete("backfill");
          params.delete("duplicates");
          const nextQ = String(fd.get("q") ?? "").trim();
          if (nextQ) params.set("q", nextQ);
          else params.delete("q");
          const nextCountry = String(fd.get("country") ?? "")
            .trim()
            .toUpperCase();
          if (nextCountry) params.set("country", nextCountry);
          else params.delete("country");
          const qs = params.toString();
          startTransition(() => {
            router.push(qs ? `${pathname}?${qs}` : pathname);
          });
        }}
      >
        <label className="flex flex-col gap-1" htmlFor="catalog-artists-search">
          <span className={labelCapsCls}>Search</span>
          <Input
            id="catalog-artists-search"
            name="q"
            type="search"
            defaultValue={defaults.q ?? ""}
            placeholder="Name or slug…"
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1" htmlFor="catalog-artists-country">
          <span className={labelCapsCls}>Country (ISO code)</span>
          <Input
            id="catalog-artists-country"
            name="country"
            type="text"
            maxLength={2}
            defaultValue={defaults.country ?? ""}
            placeholder="e.g. FR"
            className={`${inputCls} uppercase`}
          />
        </label>

        <Button type="submit" className="h-10 w-full shrink-0">
          Apply
        </Button>
      </form>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Status</span>
        <FilterSelect
          param="status"
          resetParams={{ offset: "0" }}
          className={selectCls}
          options={[
            { value: "", label: "Any" },
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "merged_into", label: "Merged" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Kind</span>
        <FilterSelect
          param="kind"
          resetParams={{ offset: "0" }}
          className={selectCls}
          options={KIND_FILTER_OPTIONS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Linked account</span>
        <FilterSelect
          param="linked"
          resetParams={{ offset: "0" }}
          defaultValue={defaults.linked ?? "any"}
          className={selectCls}
          options={[
            { value: "any", label: "Any" },
            { value: "yes", label: "Has owner account" },
            { value: "no", label: "No owner account" },
          ]}
        />
      </div>

      {categoryOptions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className={labelCapsCls}>Department</span>
          <FilterSelect
            param="categoryId"
            resetParams={{ offset: "0" }}
            className={selectCls}
            options={[{ value: "", label: "Any" }, ...categoryOptions]}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Sort</span>
        <FilterSelect
          param="sort"
          resetParams={{ offset: "0" }}
          defaultValue="name_asc"
          className={selectCls}
          options={[
            { value: "name_asc", label: "Name A–Z" },
            { value: "popular", label: "Most lots" },
            { value: "recent", label: "Recently updated" },
          ]}
        />
      </div>

      <FilterCheckboxGroup
        className="flex flex-col gap-3 border-t border-outline-variant/40 pt-3"
        resetParams={{ offset: "0" }}
        options={[
          { param: "featured", label: "Featured", checkedValue: "true" },
          { param: "verified", label: "Verified", checkedValue: "true" },
          { param: "includeArchived", label: "Include archived", checkedValue: "true" },
        ]}
      />
    </div>
  );
}

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  filterDefaults: FilterDefaults;
  categoryOptions?: readonly ArtistCategoryFilterOption[];
  /** When duplicates or lot backfill queues are showing, filters target the indexed list instead. */
  queueModesActive: boolean;
};

export function CatalogArtistsFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  activeFilterChips = [],
  filterDefaults,
  categoryOptions = [],
  queueModesActive,
}: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Artist registry view"
      activeFilterCount={activeFilterCount}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
      sheetTitle="Artist filters"
      searchSlot={
        queueModesActive ? undefined : (
          <AdminListSearch placeholder="Search artists…" className="w-full" />
        )
      }
      sheetFilters={
        queueModesActive ? (
          <div className="space-y-4">
            <p className="font-body text-sm text-on-surface-variant">
              Detailed filters apply to the main artist registry. Use the lenses to return to All,
              Pending, Featured, Maker–sellers, or reopen Queues after triage.
            </p>
            <Link
              href="/admin/artists"
              className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-4 hover:underline"
            >
              Back to registry list
            </Link>
          </div>
        ) : (
          <ArtistRegistryFilterForm defaults={filterDefaults} categoryOptions={categoryOptions} />
        )
      }
    />
  );
}
