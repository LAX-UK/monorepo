"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import { AdminUsersSavedViews } from "@/components/admin/admin-users-saved-views";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { FilterCheckboxGroup } from "@/components/ui/filter-checkbox-group";
import { FilterSelect } from "@/components/ui/filter-select";
import { SplitFilterSheet } from "@/components/ui/split-filter-sheet";
import type { UsersListFilters } from "@/lib/admin/users-list-query";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";

const inputCls = "h-10 w-full font-body text-sm";
const selectCls = "h-10 w-full font-body text-sm";
const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

const triStateOptions = [
  { value: "", label: "Any" },
  { value: "1", label: "Yes" },
  { value: "0", label: "No" },
];

type FilterDefaults = UsersListFilters;

function AdminUsersFilterForm({ defaults }: { defaults: FilterDefaults }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const params = new URLSearchParams(searchParams.toString());
        params.set("offset", "0");

        const dateFields = [
          "createdFrom",
          "createdTo",
          "kycVerifiedFrom",
          "kycVerifiedTo",
          "lastActiveFrom",
          "lastActiveTo",
        ] as const;
        for (const key of dateFields) {
          const v = String(fd.get(key) ?? "").trim();
          if (v) params.set(key, v);
          else params.delete(key);
        }

        const qs = params.toString();
        startTransition(() => {
          router.push(qs ? `${pathname}?${qs}` : pathname);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1" htmlFor="users-filter-created-from">
          <span className={labelCapsCls}>Joined from</span>
          <Input
            id="users-filter-created-from"
            name="createdFrom"
            type="date"
            defaultValue={defaults.createdFrom ?? ""}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1" htmlFor="users-filter-created-to">
          <span className={labelCapsCls}>Joined to</span>
          <Input
            id="users-filter-created-to"
            name="createdTo"
            type="date"
            defaultValue={defaults.createdTo ?? ""}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1" htmlFor="users-filter-kyc-from">
          <span className={labelCapsCls}>KYC verified from</span>
          <Input
            id="users-filter-kyc-from"
            name="kycVerifiedFrom"
            type="date"
            defaultValue={defaults.kycVerifiedFrom ?? ""}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1" htmlFor="users-filter-kyc-to">
          <span className={labelCapsCls}>KYC verified to</span>
          <Input
            id="users-filter-kyc-to"
            name="kycVerifiedTo"
            type="date"
            defaultValue={defaults.kycVerifiedTo ?? ""}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2" htmlFor="users-filter-active-from">
          <span className={labelCapsCls}>Last active from</span>
          <Input
            id="users-filter-active-from"
            name="lastActiveFrom"
            type="date"
            defaultValue={defaults.lastActiveFrom ?? ""}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2" htmlFor="users-filter-active-to">
          <span className={labelCapsCls}>Last active to</span>
          <Input
            id="users-filter-active-to"
            name="lastActiveTo"
            type="date"
            defaultValue={defaults.lastActiveTo ?? ""}
            className={inputCls}
          />
        </label>
      </div>

      <Button type="submit" className="h-10 w-full shrink-0">
        Apply dates
      </Button>
    </form>
  );
}

type Props = {
  filterDefaults: FilterDefaults;
  activeFilterCount: number;
  activeFilterChips: readonly CatalogActiveFilterChip[];
  searchPlaceholder?: string;
  sheetTitle?: string;
  /** Extra slot beside saved views (e.g. export). */
  toolbarEnd?: React.ReactNode;
};

export function AdminUsersFilterToolbar({
  filterDefaults,
  activeFilterCount,
  activeFilterChips,
  searchPlaceholder = "Search by name, email, or mobile…",
  sheetTitle = "Client filters",
  toolbarEnd,
}: Props) {
  const [open, setOpen] = useState(false);
  const filterPanelId = useId();

  const sheetFilters = (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Account status</span>
        <FilterSelect
          param="status"
          resetParams={{ offset: "0" }}
          clearParams={["suspended"]}
          className={selectCls}
          options={[
            { value: "", label: "Any" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Email verified</span>
        <FilterSelect
          param="emailVerified"
          resetParams={{ offset: "0" }}
          className={selectCls}
          options={triStateOptions}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>KYC status</span>
        <FilterSelect
          param="kycStatus"
          resetParams={{ offset: "0" }}
          clearParams={["kycStatuses"]}
          className={selectCls}
          options={[
            { value: "", label: "Any" },
            { value: "unverified", label: "Unverified" },
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Signup persona</span>
        <FilterSelect
          param="persona"
          resetParams={{ offset: "0" }}
          className={selectCls}
          options={[
            { value: "", label: "Any" },
            { value: "individual", label: "Individual" },
            { value: "organisation", label: "Organisation" },
            { value: "none", label: "Not set" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Two-factor auth</span>
        <FilterSelect
          param="twoFactor"
          resetParams={{ offset: "0" }}
          className={selectCls}
          options={triStateOptions}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Mobile on file</span>
        <FilterSelect
          param="hasMobile"
          resetParams={{ offset: "0" }}
          className={selectCls}
          options={triStateOptions}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Sort</span>
        <FilterSelect
          param="sort"
          resetParams={{ offset: "0" }}
          defaultValue="created_desc"
          className={selectCls}
          options={[
            { value: "created_desc", label: "Newest first" },
            { value: "created_asc", label: "Oldest first" },
            { value: "name_asc", label: "Name A–Z" },
            { value: "name_desc", label: "Name Z–A" },
            { value: "last_active_desc", label: "Last active" },
            { value: "kyc_status", label: "KYC status" },
          ]}
        />
      </div>

      <FilterCheckboxGroup
        className="flex flex-col gap-3 border-t border-outline-variant/40 pt-3"
        resetParams={{ offset: "0" }}
        options={[{ param: "deletionRequested", label: "Deletion requested", checkedValue: "1" }]}
      />

      <AdminUsersFilterForm defaults={filterDefaults} />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="hidden min-w-0 flex-1 lg:block lg:max-w-md">
            <AdminListSearch placeholder={searchPlaceholder} className="w-full" />
          </div>
          <MarketingFilterTrigger
            onClick={() => setOpen(true)}
            activeCount={activeFilterCount}
            aria-expanded={open}
            aria-controls={filterPanelId}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AdminUsersSavedViews />
          {toolbarEnd}
        </div>
      </div>
      <div className="lg:hidden">
        <AdminListSearch placeholder={searchPlaceholder} className="w-full" />
      </div>
      {activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null}
      <SplitFilterSheet open={open} onOpenChange={setOpen} title={sheetTitle}>
        <div id={filterPanelId} className="space-y-4">
          <div className="lg:hidden pb-3">
            <AdminListSearch placeholder={searchPlaceholder} className="w-full" />
          </div>
          {sheetFilters}
        </div>
      </SplitFilterSheet>
    </div>
  );
}
