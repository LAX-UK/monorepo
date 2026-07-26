import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";
import { signupPersonaFilterLabel } from "@/lib/admin/signup-persona-presenter";
import type { UsersListFilters } from "@/lib/admin/users-list-query";

const USER_SORT_LABELS: Record<string, string> = {
  created_desc: "Newest first",
  created_asc: "Oldest first",
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
  last_active_desc: "Last active",
  kyc_status: "KYC status",
};

const KYC_STATUS_LABELS: Record<string, string> = {
  unverified: "Unverified",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

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
  if (filters.accountStatus) {
    chips.push({
      id: "status",
      label: `Status: ${filters.accountStatus}`,
      clearHref: omitParamsHref(basePath, sp, ["status", "suspended"]),
    });
  } else if (filters.suspendedOnly) {
    chips.push({
      id: "suspended",
      label: "Suspended only",
      clearHref: omitParamsHref(basePath, sp, ["suspended"]),
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
      label: "Email unverified",
      clearHref: omitParamsHref(basePath, sp, ["emailVerified"]),
    });
  }
  if (filters.kycStatuses?.length) {
    chips.push({
      id: "kycStatuses",
      label: `KYC: ${filters.kycStatuses.map((s) => KYC_STATUS_LABELS[s] ?? s).join(", ")}`,
      clearHref: omitParamsHref(basePath, sp, ["kycStatuses", "kycStatus"]),
    });
  } else if (filters.kycStatus) {
    chips.push({
      id: "kycStatus",
      label: `KYC: ${KYC_STATUS_LABELS[filters.kycStatus] ?? filters.kycStatus}`,
      clearHref: omitParamsHref(basePath, sp, ["kycStatus", "kycStatuses"]),
    });
  }
  if (filters.persona) {
    chips.push({
      id: "persona",
      label: `Persona: ${signupPersonaFilterLabel(filters.persona)}`,
      clearHref: omitParamsHref(basePath, sp, ["persona"]),
    });
  }
  if (filters.twoFactorEnabled === true) {
    chips.push({
      id: "twoFactor",
      label: "2FA enabled",
      clearHref: omitParamsHref(basePath, sp, ["twoFactor"]),
    });
  } else if (filters.twoFactorEnabled === false) {
    chips.push({
      id: "twoFactor",
      label: "2FA off",
      clearHref: omitParamsHref(basePath, sp, ["twoFactor"]),
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
      label: `Joined: ${filters.createdFrom ?? "…"} – ${filters.createdTo ?? "…"}`,
      clearHref: omitParamsHref(basePath, sp, ["createdFrom", "createdTo"]),
    });
  }
  if (filters.kycVerifiedFrom || filters.kycVerifiedTo) {
    chips.push({
      id: "kycVerified",
      label: `KYC verified: ${filters.kycVerifiedFrom ?? "…"} – ${filters.kycVerifiedTo ?? "…"}`,
      clearHref: omitParamsHref(basePath, sp, ["kycVerifiedFrom", "kycVerifiedTo"]),
    });
  }
  if (filters.lastActiveFrom || filters.lastActiveTo) {
    chips.push({
      id: "lastActive",
      label: `Last active: ${filters.lastActiveFrom ?? "…"} – ${filters.lastActiveTo ?? "…"}`,
      clearHref: omitParamsHref(basePath, sp, ["lastActiveFrom", "lastActiveTo"]),
    });
  }
  if (filters.sort && filters.sort !== "created_desc") {
    chips.push({
      id: "sort",
      label: `Sort: ${USER_SORT_LABELS[filters.sort] ?? filters.sort}`,
      clearHref: omitParamsHref(basePath, sp, ["sort"]),
    });
  }

  return chips;
}
