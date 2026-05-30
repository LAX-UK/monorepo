/** Central admin catalog route paths (Lots + Sales staff). */

export function adminLotListPath(): string {
  return "/admin/lots";
}

export function adminLotPath(lotId: string): string {
  return `/admin/lots/${lotId}`;
}

export function adminSaleListPath(): string {
  return "/admin/sales";
}

export function adminSalePath(saleId: string): string {
  return `/admin/sales/${saleId}`;
}
