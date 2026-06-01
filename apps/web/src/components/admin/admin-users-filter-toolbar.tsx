"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminListSearch } from "@/components/admin/admin-list-search";
import { AdminUsersSavedViews } from "@/components/admin/admin-users-saved-views";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { FilterCheckboxGroup } from "@/components/ui/filter-checkbox-group";
import { FilterSelect } from "@/components/ui/filter-select";
import type { UsersListFilters } from "@/lib/admin/users-list-query";
import { Button } from "@auction/ui/components/button";
import { DateRangePicker, type DateRangeValue } from "@auction/ui/components/date-range-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const selectCls = "h-10 w-full font-body text-sm";
const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

const triStateOptions = [
  { value: "", label: "Any" },
  { value: "1", label: "Yes" },
  { value: "0", label: "No" },
];

type FilterDefaults = UsersListFilters;

function dateRangeFromDefaults(from?: string, to?: string): DateRangeValue {
  return { from: from ?? "", to: to ?? "" };
}

function applyDateRangeToParams(
  params: URLSearchParams,
  fromKey: string,
  toKey: string,
  range: DateRangeValue,
) {
  const from = range.from.trim();
  const to = range.to.trim();
  if (from) params.set(fromKey, from);
  else params.delete(fromKey);
  if (to) params.set(toKey, to);
  else params.delete(toKey);
}

function AdminUsersFilterForm({ defaults }: { defaults: FilterDefaults }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [joined, setJoined] = useState(() =>
    dateRangeFromDefaults(defaults.createdFrom, defaults.createdTo),
  );
  const [kycVerified, setKycVerified] = useState(() =>
    dateRangeFromDefaults(defaults.kycVerifiedFrom, defaults.kycVerifiedTo),
  );
  const [lastActive, setLastActive] = useState(() =>
    dateRangeFromDefaults(defaults.lastActiveFrom, defaults.lastActiveTo),
  );

  const applyDates = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("offset", "0");
    applyDateRangeToParams(params, "createdFrom", "createdTo", joined);
    applyDateRangeToParams(params, "kycVerifiedFrom", "kycVerifiedTo", kycVerified);
    applyDateRangeToParams(params, "lastActiveFrom", "lastActiveTo", lastActive);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Joined</span>
        <DateRangePicker value={joined} onChange={setJoined} />
      </div>
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>KYC verified</span>
        <DateRangePicker value={kycVerified} onChange={setKycVerified} />
      </div>
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Last active</span>
        <DateRangePicker value={lastActive} onChange={setLastActive} />
      </div>

      <Button type="button" className="h-10 w-full shrink-0" onClick={applyDates}>
        Apply dates
      </Button>
    </div>
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
  const sheetFilters = (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Account status</span>
        <FilterSelect
          param="status"
          resetParams={{ offset: "0" }}
          clearParams={["suspended"]}
          className={selectCls}
          ariaLabel="Account status"
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
          ariaLabel="Email verified"
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
          ariaLabel="KYC status"
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
          ariaLabel="Signup persona"
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
          ariaLabel="Two-factor authentication"
          options={triStateOptions}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Mobile on file</span>
        <FilterSelect
          param="hasMobile"
          resetParams={{ offset: "0" }}
          className={selectCls}
          ariaLabel="Mobile on file"
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
          ariaLabel="Sort order"
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

      <AdminUsersFilterForm
        key={[
          filterDefaults.createdFrom,
          filterDefaults.createdTo,
          filterDefaults.kycVerifiedFrom,
          filterDefaults.kycVerifiedTo,
          filterDefaults.lastActiveFrom,
          filterDefaults.lastActiveTo,
        ].join("|")}
        defaults={filterDefaults}
      />
    </div>
  );

  return (
    <AdminFilterBar
      sheetTitle={sheetTitle}
      sheetFilters={sheetFilters}
      activeFilterCount={activeFilterCount}
      searchSlot={<AdminListSearch placeholder={searchPlaceholder} className="w-full" />}
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
      toolbarEnd={
        <>
          <AdminUsersSavedViews />
          {toolbarEnd}
        </>
      }
    />
  );
}
