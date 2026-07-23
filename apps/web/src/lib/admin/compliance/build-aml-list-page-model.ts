import { buildListHref } from "@/lib/admin/admin-list-params";

export const AML_LIST_PATH = "/admin/compliance/aml";

export type AmlListSearchParams = {
  error?: string;
  success?: string;
  limit?: string;
  offset?: string;
  screening?: string;
};

export function buildAmlListPageModel(sp: AmlListSearchParams) {
  const limit = Math.min(100, Math.max(1, Number(sp.limit ?? 100) || 100));
  const offset = Math.max(0, Number(sp.offset ?? 0) || 0);
  const selectedScreeningId = sp.screening?.trim() || undefined;

  const listQueryParams = { limit, offset };

  return {
    basePath: AML_LIST_PATH,
    query: { offset, limit },
    listQueryParams,
    selectedScreeningId,
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(AML_LIST_PATH, sp, patch),
  };
}

export type AmlListPageModel = ReturnType<typeof buildAmlListPageModel>;
