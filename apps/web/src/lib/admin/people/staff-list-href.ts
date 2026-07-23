import { buildListHref } from "@/lib/admin/admin-list-params";
import { readSearchParamsRecord } from "@/lib/admin/lot-fulfilment-list-href";
import { STAFF_LIST_PATH } from "@/lib/admin/people/build-staff-list-page-model";

type SearchParamsLike = {
  forEach(callback: (value: string, key: string) => void): void;
};

export function buildStaffDrawerHref(
  searchParams: SearchParamsLike,
  staffId: string | null,
): string {
  return buildListHref(
    STAFF_LIST_PATH,
    readSearchParamsRecord(searchParams),
    staffId ? { staff: staffId } : { staff: "" },
  );
}
