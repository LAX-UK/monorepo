import { disputesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";

export type DisputesListSearchParams = {
  limit?: string;
  offset?: string;
  error?: string;
  status?: string;
};

const path = "/admin/disputes";

export function buildDisputesListPageModel(sp: DisputesListSearchParams) {
  const query = disputesListController.parseQuery(sp);
  const listQueryParams = {
    offset: query.offset,
    limit: query.limit,
    ...(query.status ? { status: query.status } : {}),
  };
  const statusChipSpecs = [
    { id: "all", label: "All", value: undefined },
    { id: "open", label: "Open", value: "open" },
    { id: "under_review", label: "Under review", value: "under_review" },
    { id: "closed", label: "Closed", value: "closed" },
  ].map((item) => ({
    id: item.id,
    label: item.label,
    href: buildListHref(path, sp, { status: item.value, offset: 0 }),
    active: item.value ? query.status === item.value : !query.status,
  }));

  return {
    query,
    listQueryParams,
    statusChipSpecs,
    hasFilters: Boolean(query.status),
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(path, sp, patch),
  };
}
