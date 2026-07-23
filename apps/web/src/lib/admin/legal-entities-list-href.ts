import { buildListHref } from "@/lib/admin/admin-list-params";
import { LEGAL_ENTITIES_LIST_PATH } from "@/lib/admin/people/build-legal-entities-list-page-model";

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

export function buildLegalEntitiesDrawerHref(
  searchParams: SearchParamsLike,
  entityId: string | null,
): string {
  return buildListHref(
    LEGAL_ENTITIES_LIST_PATH,
    readSearchParamsRecord(searchParams),
    entityId ? { entity: entityId } : { entity: "" },
  );
}
