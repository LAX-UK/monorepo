import { adminLotListPath, adminLotPath, adminSaleListPath, adminSalePath } from "./catalog-routes";

export { adminLotListPath as adminLotListHref };
export { adminLotPath as adminLotHref };
export { adminSaleListPath as adminSaleListHref };
export { adminSalePath as adminSaleHref };

export function adminLotNewHref(opts?: { fromLot?: string }): string {
  const base = `${adminLotListPath()}/new`;
  return opts?.fromLot ? `${base}?fromLot=${encodeURIComponent(opts.fromLot)}` : base;
}

export function adminSaleNewHref(): string {
  return `${adminSaleListPath()}/new`;
}

export function adminSaleroomHref(saleId: string): string {
  return `/admin/saleroom/${saleId}`;
}

export function adminLotEditHref(lotId: string): string {
  return `${adminLotPath(lotId)}/edit`;
}

export function adminLotEditCatalogHref(lotId: string): string {
  return `${adminLotEditHref(lotId)}/catalog`;
}

export function adminLotDetailTabHref(lotId: string, tab: string): string {
  if (tab === "overview") return adminLotPath(lotId);
  return `${adminLotPath(lotId)}/${tab}`;
}

export function adminSaleEditHref(saleId: string): string {
  return `${adminSalePath(saleId)}/edit`;
}

export function adminSaleDetailTabHref(saleId: string, tab: string): string {
  if (tab === "overview") return adminSalePath(saleId);
  return `${adminSalePath(saleId)}/${tab}`;
}

export function adminSaleSetupHref(saleId: string, step?: string): string {
  const base = `${adminSalePath(saleId)}/setup`;
  return step ? `${base}?step=${step}` : base;
}
