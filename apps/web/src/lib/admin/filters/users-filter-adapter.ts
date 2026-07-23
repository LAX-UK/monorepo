import {
  hrefFromSearchParams,
  mergeFilterSearchParams,
} from "@/lib/admin/filters/merge-filter-params";
import type { AdminFilterAdapter, AdminFilterPreserved } from "@/lib/admin/filters/types";

export type UsersFilterDraft = {
  status: string;
  emailVerified: string;
  kycStatus: string;
  persona: string;
  twoFactor: string;
  hasMobile: string;
  sort: string;
  deletionRequested: boolean;
  createdFrom: string;
  createdTo: string;
  kycVerifiedFrom: string;
  kycVerifiedTo: string;
  lastActiveFrom: string;
  lastActiveTo: string;
};

function parseDraft(
  searchParams: URLSearchParams,
  _preserved: AdminFilterPreserved,
): UsersFilterDraft {
  return {
    status: searchParams.get("status")?.trim() ?? "",
    emailVerified: searchParams.get("emailVerified")?.trim() ?? "",
    kycStatus: searchParams.get("kycStatus")?.trim() ?? "",
    persona: searchParams.get("persona")?.trim() ?? "",
    twoFactor: searchParams.get("twoFactor")?.trim() ?? "",
    hasMobile: searchParams.get("hasMobile")?.trim() ?? "",
    sort: searchParams.get("sort")?.trim() || "created_desc",
    deletionRequested: searchParams.get("deletionRequested") === "1",
    createdFrom: searchParams.get("createdFrom")?.trim() ?? "",
    createdTo: searchParams.get("createdTo")?.trim() ?? "",
    kycVerifiedFrom: searchParams.get("kycVerifiedFrom")?.trim() ?? "",
    kycVerifiedTo: searchParams.get("kycVerifiedTo")?.trim() ?? "",
    lastActiveFrom: searchParams.get("lastActiveFrom")?.trim() ?? "",
    lastActiveTo: searchParams.get("lastActiveTo")?.trim() ?? "",
  };
}

export const usersFilterAdapter: AdminFilterAdapter<UsersFilterDraft> = {
  parse: parseDraft,
  defaults: () => ({
    status: "",
    emailVerified: "",
    kycStatus: "",
    persona: "",
    twoFactor: "",
    hasMobile: "",
    sort: "created_desc",
    deletionRequested: false,
    createdFrom: "",
    createdTo: "",
    kycVerifiedFrom: "",
    kycVerifiedTo: "",
    lastActiveFrom: "",
    lastActiveTo: "",
  }),
  buildHref(pathname, current, draft, preserved) {
    const patch: Record<string, string | boolean | undefined | null> = {
      status: draft.status.trim() || null,
      emailVerified: draft.emailVerified.trim() || null,
      kycStatus: draft.kycStatus.trim() || null,
      kycStatuses: draft.kycStatus.trim() ? null : null,
      persona: draft.persona.trim() || null,
      twoFactor: draft.twoFactor.trim() || null,
      hasMobile: draft.hasMobile.trim() || null,
      sort: draft.sort === "created_desc" ? null : draft.sort,
      deletionRequested: draft.deletionRequested ? "1" : null,
      createdFrom: draft.createdFrom.trim() || null,
      createdTo: draft.createdTo.trim() || null,
      kycVerifiedFrom: draft.kycVerifiedFrom.trim() || null,
      kycVerifiedTo: draft.kycVerifiedTo.trim() || null,
      lastActiveFrom: draft.lastActiveFrom.trim() || null,
      lastActiveTo: draft.lastActiveTo.trim() || null,
    };
    if (draft.status.trim()) patch.suspended = null;

    const params = mergeFilterSearchParams(current, patch, preserved);
    return hrefFromSearchParams(pathname, params);
  },
  isDirty(draft, applied) {
    return JSON.stringify(draft) !== JSON.stringify(applied);
  },
};
