import { buildListHref } from "@/lib/admin/admin-list-params";
import { readSearchParamsRecord } from "@/lib/admin/lot-fulfilment-list-href";
import { CLIENTS_LIST_PATH } from "@/lib/admin/people/build-clients-list-page-model";

type SearchParamsLike = {
  forEach(callback: (value: string, key: string) => void): void;
};

export function buildClientsDrawerHref(
  searchParams: SearchParamsLike,
  clientId: string | null,
): string {
  return buildListHref(
    CLIENTS_LIST_PATH,
    readSearchParamsRecord(searchParams),
    clientId ? { client: clientId } : { client: "" },
  );
}
