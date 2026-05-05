import { notify } from "@/lib/ui/notify";

export const ADMIN_CANNOT_BUY_TITLE = "Staff account";

export const ADMIN_CANNOT_BUY_DESCRIPTION =
  "Staff accounts cannot place bids or buy artworks. Sign in with a client (collector) account to participate.";

/** API returns `{ error: "bidding_not_allowed_for_role" }` (legacy: `admin_cannot_buy`) with 403 from buyer-gated mutations. */
export function isAdminCannotBuyApiError(error: string | undefined, status: number): boolean {
  return (
    status === 403 && (error === "bidding_not_allowed_for_role" || error === "admin_cannot_buy")
  );
}

export function toastAdminCannotBuy(): void {
  notify.error(ADMIN_CANNOT_BUY_TITLE, {
    description: ADMIN_CANNOT_BUY_DESCRIPTION,
    id: "admin-cannot-buy",
    duration: 8000,
  });
}

export function notifyAdminCannotBuyIfNeeded(error: string | undefined, status: number): void {
  if (isAdminCannotBuyApiError(error, status)) {
    toastAdminCannotBuy();
  }
}
