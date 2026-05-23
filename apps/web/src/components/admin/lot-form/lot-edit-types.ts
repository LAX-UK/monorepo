export const LOT_EDIT_SECTIONS = ["auction", "catalog", "documents"] as const;

export type LotEditSection = (typeof LOT_EDIT_SECTIONS)[number];

export function lotEditSectionHref(
  lotId: string,
  section: LotEditSection,
  canEditCore: boolean,
): string {
  const base = `/admin/lots/${lotId}/edit`;
  if (section === "auction" && canEditCore) return base;
  if (section === "catalog") return `${base}/catalog`;
  if (section === "documents") return `${base}/documents`;
  return canEditCore ? base : `${base}/catalog`;
}

export function parseLotEditSectionFromPath(
  pathname: string,
  lotId: string,
  canEditCore: boolean,
): LotEditSection {
  const prefix = `/admin/lots/${lotId}/edit`;
  if (pathname === `${prefix}/catalog` || pathname.startsWith(`${prefix}/catalog/`)) {
    return "catalog";
  }
  if (pathname === `${prefix}/documents` || pathname.startsWith(`${prefix}/documents/`)) {
    return "documents";
  }
  return canEditCore ? "auction" : "catalog";
}
