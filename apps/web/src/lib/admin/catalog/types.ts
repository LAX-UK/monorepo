import type { AdminStatusDomain } from "@/lib/presenters/status/core";
import type { ReactNode } from "react";

/** Dismissible chip for URL-driven catalog list filters (GET clear links). */
export type CatalogActiveFilterChip = {
  id: string;
  label: string;
  clearHref: string;
};

/** GET-based lens segment for catalog list sticky nav. */
export type CatalogSegmentItem = {
  id: string;
  label: string;
  href: string;
  badge?: number;
  disabled?: boolean;
};

/** Props shared by {@link CatalogSegmentNav} (component re-exports this contract). */
export type CatalogSegmentNavProps = {
  items: readonly CatalogSegmentItem[];
  activeId: string;
  "aria-label": string;
  className?: string;
};

/** Mobile sticky action bar item for catalog detail/list chrome. */
export type CatalogMobileAction = {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  /** When set, renders a native submit for that form id (cannot combine with href). */
  htmlForm?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

export type CatalogMobileActionsPlacement = "header" | "bar" | "none";

/** Compact metric item for catalog detail overview summary strips. */
export type CatalogDetailSummaryItem = {
  id: string;
  label: string;
  value: ReactNode;
  /** When set, summary strip renders AdminStatusBadge instead of plain value text. */
  status?: { domain: AdminStatusDomain; status: string };
  hint?: string;
  href?: string;
};
