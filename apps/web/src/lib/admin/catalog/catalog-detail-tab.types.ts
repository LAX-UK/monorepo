import type { ReactNode } from "react";

export type CatalogDetailTabBadge = "pending" | "warning" | "default";

export type CatalogDetailTabEntityKind =
  | "lot"
  | "sale"
  | "category"
  | "artist"
  | "submission"
  | "venue"
  | "legal-entity"
  | "person"
  | "operations";

export type CatalogDetailTabSpec = {
  id: string;
  label: ReactNode;
  href: string;
  badge?: CatalogDetailTabBadge;
  /** Optional numeric count badge on tab labels. */
  count?: number;
};
