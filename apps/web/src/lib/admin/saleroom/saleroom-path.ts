/** The saleroom page for a sale, or the saleroom list when no sale is known. */
export function saleroomPath(saleId: string): string {
  return saleId ? `/admin/saleroom/${encodeURIComponent(saleId)}` : "/admin/saleroom";
}
