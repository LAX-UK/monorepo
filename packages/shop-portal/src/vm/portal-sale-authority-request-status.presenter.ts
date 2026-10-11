export function formatPortalSaleAuthorityRequestStatus(status: string): string {
  if (status === "rejected") return "Declined";
  if (status === "pending") return "Pending";
  if (status === "approved") return "Approved";
  return status.replaceAll("_", " ");
}
