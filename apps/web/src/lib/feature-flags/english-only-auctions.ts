/** When true (default), admin lot flows and V1 bidding surfaces only support English (+ buy-now) mechanics. Set `NEXT_PUBLIC_ENGLISH_ONLY_AUCTIONS=false` to unlock all auction types in the UI. */
export function isEnglishOnlyAuctionsLocked(): boolean {
  return process.env.NEXT_PUBLIC_ENGLISH_ONLY_AUCTIONS !== "false";
}
