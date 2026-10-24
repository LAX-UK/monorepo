import { buildListHref } from "@/lib/admin/admin-list-params";
import { ADMIN_LIST_RETURN_TO_PARAM } from "@/lib/admin/admin-list-return-context";

export type SofListStatus = "pending" | "rejected" | "approved";

/** Preserves list tab when opening detail from queue links and error recovery. */
export const SOF_LIST_STATUS_PARAM = "listStatus";

const SOF_LIST_STATUSES: SofListStatus[] = ["pending", "rejected", "approved"];

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

export function buildSofCaseDetailHref(
  caseId: string,
  listStatus: SofListStatus,
  returnTo?: string,
): string {
  const params = new URLSearchParams({ [SOF_LIST_STATUS_PARAM]: listStatus });
  if (returnTo?.trim()) {
    params.set(ADMIN_LIST_RETURN_TO_PARAM, returnTo.trim());
  }
  return `/admin/compliance/source-of-funds/${encodeURIComponent(caseId)}?${params.toString()}`;
}

export function buildSofListHref(listStatus: SofListStatus = "pending", returnTo?: string): string {
  const href = buildListHref("/admin/compliance/source-of-funds", {}, { status: listStatus });
  if (!returnTo?.trim()) return href;
  const params = new URLSearchParams(href.includes("?") ? href.split("?")[1] : "");
  params.set(ADMIN_LIST_RETURN_TO_PARAM, returnTo.trim());
  const path = href.split("?")[0] ?? href;
  return `${path}?${params.toString()}`;
}

export type SofListQuery = {
  limit: number;
  offset: number;
  q?: string | undefined;
  sort?: string | undefined;
  status: SofListStatus;
};
