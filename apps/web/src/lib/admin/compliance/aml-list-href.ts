import { buildListHref } from "@/lib/admin/admin-list-params";
import { AML_LIST_PATH } from "@/lib/admin/compliance/build-aml-list-page-model";

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

export function buildAmlDrawerHref(
  searchParams: SearchParamsLike,
  screeningId: string | null,
): string {
  return buildListHref(
    AML_LIST_PATH,
    readSearchParamsRecord(searchParams),
    screeningId ? { screening: screeningId } : { screening: "" },
  );
}
