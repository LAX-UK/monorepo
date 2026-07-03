export type SellerPayoutPendingPreview = {
  pendingGross: string;
  pendingPlatformFee: string;
  pendingNet: string;
  paymentCount: number;
  currency: string;
};

export type PayoutsLoadError = "unauthorized" | "forbidden" | "server_error";

export type SellerPayoutListResult =
  | { ok: true; payouts: import("@auction/types").Payout[] }
  | { ok: false; error: PayoutsLoadError };

export type SellerPayoutPreviewResult =
  | { ok: true; data: SellerPayoutPendingPreview }
  | { ok: false; error: PayoutsLoadError };
