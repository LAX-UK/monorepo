import { buildListHref } from "@/lib/admin/admin-list-params";

export type SofListStatus = "pending" | "rejected" | "approved";

/** Preserves list tab when opening detail from queue links and error recovery. */
export const SOF_LIST_STATUS_PARAM = "listStatus";

const SOF_LIST_STATUSES: SofListStatus[] = ["pending", "rejected", "approved"];

export type SofStatusChip = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
};

export function normalizeSofListStatus(status: string): SofListStatus {
  if (status === "rejected" || status === "approved") return status;
  return "pending";
}

export function parseSofListStatus(
  sp: Record<string, string | string[] | undefined>,
): SofListStatus {
  const raw = sp.status;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && SOF_LIST_STATUSES.includes(value as SofListStatus)) {
    return value as SofListStatus;
  }
  return "pending";
}

export function parseSofDetailListStatus(
  sp: Record<string, string | string[] | undefined> | URLSearchParams,
): SofListStatus {
  const raw =
    sp instanceof URLSearchParams ? sp.get(SOF_LIST_STATUS_PARAM) : sp[SOF_LIST_STATUS_PARAM];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && SOF_LIST_STATUSES.includes(value as SofListStatus)) {
    return value as SofListStatus;
  }
  return "pending";
}

export function buildSofStatusChips(
  basePath: string,
  sp: Record<string, string | string[] | undefined>,
  activeStatus: SofListStatus,
): SofStatusChip[] {
  return [
    {
      id: "pending",
      label: "Pending",
      href: buildListHref(basePath, sp, { status: "pending", offset: 0 }),
      active: activeStatus === "pending",
    },
    {
      id: "rejected",
      label: "Rejected",
      href: buildListHref(basePath, sp, { status: "rejected", offset: 0 }),
      active: activeStatus === "rejected",
    },
    {
      id: "approved",
      label: "Approved",
      href: buildListHref(basePath, sp, { status: "approved", offset: 0 }),
      active: activeStatus === "approved",
    },
  ];
}

export function buildSofCaseDetailHref(caseId: string, listStatus: SofListStatus): string {
  const params = new URLSearchParams({ [SOF_LIST_STATUS_PARAM]: listStatus });
  return `/admin/compliance/source-of-funds/${encodeURIComponent(caseId)}?${params.toString()}`;
}

export function buildSofListHref(listStatus: SofListStatus = "pending"): string {
  return buildListHref("/admin/compliance/source-of-funds", {}, { status: listStatus });
}

export type SofListQuery = {
  limit: number;
  offset: number;
  q?: string | undefined;
  sort?: string | undefined;
  status: SofListStatus;
};

/** Shared compliance queue cross-links for AML and Source of Funds list pages. */
export function complianceQueueCrossLinksMeta(): {
  sofHref: string;
  amlHref: string;
  paymentsHref: string;
} {
  return {
    sofHref: "/admin/compliance/source-of-funds",
    amlHref: "/admin/compliance/aml",
    paymentsHref: "/admin/payments?manualReview=1",
  };
}
