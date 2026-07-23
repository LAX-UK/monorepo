import { buildListHref } from "@/lib/admin/admin-list-params";
import { CONDITION_REPORTS_LIST_PATH } from "@/lib/admin/build-condition-reports-list-page-model";

type SearchParamsLike = {
  forEach(callback: (value: string, key: string) => void): void;
};

export function readSearchParamsRecord(
  searchParams: SearchParamsLike,
): Record<string, string | string[] | undefined> {
  const current: Record<string, string | string[] | undefined> = {};
  searchParams.forEach((value, key) => {
    current[key] = value;
  });
  return current;
}

export function buildConditionReportsDrawerHref(
  searchParams: SearchParamsLike,
  requestId: string | null,
): string {
  return buildListHref(
    CONDITION_REPORTS_LIST_PATH,
    readSearchParamsRecord(searchParams),
    requestId ? { request: requestId } : { request: "" },
  );
}
