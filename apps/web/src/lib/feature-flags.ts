/** When true, show deferred live-bidding navigation (command palette + any gated links). */
export function showLiveBiddingNav(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_LIVE_BIDDING_NAV === "true";
}
