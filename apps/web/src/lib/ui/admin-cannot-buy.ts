import { toast } from "sonner";

export const ADMIN_CANNOT_BUY_TITLE = "Admin account";

export const ADMIN_CANNOT_BUY_DESCRIPTION =
  "Administrator accounts cannot place bids or buy artworks. Sign in with a collector account to participate.";

/** API returns `{ error: "admin_cannot_buy" }` with 403 from buyer-gated mutations. */
export function isAdminCannotBuyApiError(error: string | undefined, status: number): boolean {
  return status === 403 && error === "admin_cannot_buy";
}

export function toastAdminCannotBuy(): void {
  toast.error(ADMIN_CANNOT_BUY_TITLE, {
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
