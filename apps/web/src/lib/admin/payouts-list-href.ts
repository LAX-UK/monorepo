import { buildListHref } from "@/lib/admin/admin-list-params";

export const PAYOUTS_LIST_PATH = "/admin/payouts";

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

export function buildPayoutsDrawerHref(
  searchParams: SearchParamsLike,
  payoutId: string | null,
): string {
  return buildListHref(
    PAYOUTS_LIST_PATH,
    readSearchParamsRecord(searchParams),
    payoutId ? { payout: payoutId } : { payout: "" },
  );
}
