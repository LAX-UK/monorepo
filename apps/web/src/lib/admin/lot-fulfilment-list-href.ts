import { buildListHref } from "@/lib/admin/admin-list-params";
import { LOT_FULFILMENT_LIST_PATH } from "@/lib/admin/build-lot-fulfilment-list-page-model";

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

export function buildLotFulfilmentDrawerHref(
  searchParams: SearchParamsLike,
  lotId: string | null,
): string {
  return buildListHref(
    LOT_FULFILMENT_LIST_PATH,
    readSearchParamsRecord(searchParams),
    lotId ? { lot: lotId } : { lot: "" },
  );
}
