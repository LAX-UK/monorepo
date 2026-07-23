import { buildListHref } from "@/lib/admin/admin-list-params";
import { ONBOARDING_ISSUES_LIST_PATH } from "@/lib/admin/build-onboarding-issues-list-page-model";

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

export function buildOnboardingIssuesItemHref(
  searchParams: SearchParamsLike,
  itemId: string | null,
): string {
  return buildListHref(
    ONBOARDING_ISSUES_LIST_PATH,
    readSearchParamsRecord(searchParams),
    itemId ? { item: itemId } : { item: "" },
  );
}
