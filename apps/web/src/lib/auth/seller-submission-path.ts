/** Seller consignment routes under the client dashboard shell. */
export function isSellerSubmissionPath(path: string): boolean {
  const pathOnly = path.split("?")[0] ?? path;
  return pathOnly === "/dashboard/submissions" || pathOnly.startsWith("/dashboard/submissions/");
}

/** Login handoff for unauthenticated sell-intake with intent preserved. */
export function sellLoginRedirect(next: string): string {
  const params = new URLSearchParams({ next, intent: "sell" });
  return `/login?${params.toString()}`;
}
