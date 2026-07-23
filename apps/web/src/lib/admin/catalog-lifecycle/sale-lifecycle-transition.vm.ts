/** Serializable rules for admin sale lifecycle confirmation UX. */
export function saleDeleteRequiresTypedConfirmation(saleStatus: string): boolean {
  return saleStatus === "draft";
}

export function lotCancelShouldCollectReason(status: string): boolean {
  return status === "active" || status === "scheduled";
}
