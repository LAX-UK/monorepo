import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";
import { signupPersonaFilterLabel } from "@/lib/admin/signup-persona-presenter";
import { staffIdentityStatus } from "@/lib/admin/staff-kit-status";
import type { UsersListFilters } from "@/lib/admin/users-list-query";
import { formatStaffDay } from "@auction/staff-ui";

function identityLabel(status: string): string {
  return staffIdentityStatus(status).label;
}

function dayRangeLabel(from: string | undefined, to: string | undefined): string {
  if (from && to) return `${formatStaffDay(from)} to ${formatStaffDay(to)}`;
  if (from) return `from ${formatStaffDay(from)}`;
  return `until ${formatStaffDay(to ?? "")}`;
}

/**
 * The filters in force as chips. The account standing is a view tab and the sort shows in the
 * column header, so neither is a chip.
 */
export function buildUsersActiveFilterChips(
  basePath: string,
  sp: SearchParams,
  filters: UsersListFilters,
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];

  if (filters.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${filters.q.trim()}`,
      clearHref: omitParamsHref(basePath, sp, ["q"]),
    });
  }
  if (filters.emailVerified === true) {
    chips.push({
      id: "emailVerified",
      label: "Email verified",
      clearHref: omitParamsHref(basePath, sp, ["emailVerified"]),
    });
  } else if (filters.emailVerified === false) {
    chips.push({
      id: "emailVerified",
      label: "Email not verified",
      clearHref: omitParamsHref(basePath, sp, ["emailVerified"]),
    });
  }
  if (filters.kycStatuses?.length) {
    chips.push({
      id: "kycStatuses",
      label: `Identity: ${filters.kycStatuses.map(identityLabel).join(", ")}`,
      clearHref: omitParamsHref(basePath, sp, ["kycStatuses", "kycStatus"]),
    });
  } else if (filters.kycStatus) {
    chips.push({
      id: "kycStatus",
      label: `Identity: ${identityLabel(filters.kycStatus)}`,
      clearHref: omitParamsHref(basePath, sp, ["kycStatus", "kycStatuses"]),
    });
  }
  if (filters.persona) {
    chips.push({
      id: "persona",
      label: `Signed up as: ${signupPersonaFilterLabel(filters.persona)}`,
      clearHref: omitParamsHref(basePath, sp, ["persona"]),
    });
  }
  if (filters.deletionRequestedOnly) {
    chips.push({
      id: "deletionRequested",
      label: "Deletion requested",
      clearHref: omitParamsHref(basePath, sp, ["deletionRequested"]),
    });
  }
  if (filters.hasMobile === true) {
    chips.push({
      id: "hasMobile",
      label: "Has mobile",
      clearHref: omitParamsHref(basePath, sp, ["hasMobile"]),
    });
  } else if (filters.hasMobile === false) {
    chips.push({
      id: "hasMobile",
      label: "No mobile",
      clearHref: omitParamsHref(basePath, sp, ["hasMobile"]),
    });
  }
  if (filters.createdFrom || filters.createdTo) {
    chips.push({
      id: "created",
      label: `Joined ${dayRangeLabel(filters.createdFrom, filters.createdTo)}`,
      clearHref: omitParamsHref(basePath, sp, ["createdFrom", "createdTo"]),
    });
  }
  if (filters.kycVerifiedFrom || filters.kycVerifiedTo) {
    chips.push({
      id: "kycVerified",
      label: `Identity verified ${dayRangeLabel(filters.kycVerifiedFrom, filters.kycVerifiedTo)}`,
      clearHref: omitParamsHref(basePath, sp, ["kycVerifiedFrom", "kycVerifiedTo"]),
    });
  }
  return chips;
}
