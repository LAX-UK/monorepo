import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  type CatalogMobileAction,
} from "@/components/admin/catalog";
import type { ReactNode } from "react";

export type AdminEntityDetailShellProps = {
  breadcrumbs?: ReactNode;
  title: ReactNode;
  description?: string | undefined;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
  backHref?: string;
  backLabel?: string;
  eyebrow?: ReactNode;
  entityId?: string;
  updatedAt?: Date | string;
  publicHref?: string;
  publicLabel?: string;
  /** Catalog-style sticky tab nav rendered above main content. */
  stickySubnav?: ReactNode;
  mobileActions?: readonly CatalogMobileAction[];
  mobileMeta?: ReactNode;
  /** Status badge or chips shown in the compact mobile meta row. */
  mobileMetaStatus?: ReactNode;
  mobileMetaQuickLinks?: readonly { label: string; href: string }[];
  mobileMetaPrimaryAction?: ReactNode;
};

/**
 * Compatibility wrapper over CatalogDetailShell for legacy entity detail call sites.
 * Prefer domain shells (PeopleDetailShell, LegalEntityDetailShell, etc.) for new work.
 *
 * Side rails are deprecated — use header actions, tab content, and CatalogDetailMobileMeta.
 */
export function AdminEntityDetailShell({
  breadcrumbs,
  title,
  description,
  meta,
  actions,
  children,
  className,
  backHref,
  backLabel,
  eyebrow,
  entityId,
  updatedAt,
  publicHref,
  publicLabel = "View on site",
  stickySubnav,
  mobileActions,
  mobileMeta,
  mobileMetaStatus,
  mobileMetaQuickLinks,
  mobileMetaPrimaryAction,
}: AdminEntityDetailShellProps) {
  const resolvedBreadcrumbs =
    breadcrumbs ??
    (backHref && backLabel ? (
      <CatalogBreadcrumbs
        segments={[
          { label: backLabel, href: backHref },
          { label: typeof title === "string" ? title : "Detail" },
        ]}
      />
    ) : undefined);

  const resolvedMobileMeta =
    mobileMeta ??
    (entityId || updatedAt || publicHref || mobileMetaStatus ? (
      <CatalogDetailMobileMeta
        {...(entityId ? { entityId } : {})}
        {...(updatedAt ? { updatedAt } : {})}
        {...(publicHref ? { publicHref, publicLabel } : {})}
        {...(mobileMetaStatus ? { status: mobileMetaStatus } : {})}
        {...(mobileMetaQuickLinks ? { quickLinks: mobileMetaQuickLinks } : {})}
        {...(mobileMetaPrimaryAction ? { primaryAction: mobileMetaPrimaryAction } : {})}
      />
    ) : undefined);

  return (
    <CatalogDetailShell
      {...(className ? { className } : {})}
      {...(resolvedBreadcrumbs ? { breadcrumbs: resolvedBreadcrumbs } : {})}
      {...(eyebrow ? { eyebrow } : {})}
      title={title}
      {...(description ? { description } : {})}
      {...(meta ? { meta } : {})}
      metaBelowTitle
      {...(actions ? { actions } : {})}
      {...(mobileActions ? { mobileActions } : {})}
      {...(resolvedMobileMeta ? { mobileMeta: resolvedMobileMeta } : {})}
      {...(stickySubnav ? { stickySubnav } : {})}
    >
      {children}
    </CatalogDetailShell>
  );
}
