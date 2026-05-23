import { CatalogInfoAside } from "@/components/admin/catalog/catalog-info-aside";
import type { ReactNode } from "react";

type Props = {
  entityId?: string;
  updatedAt?: Date | string;
  publicHref?: string;
  publicLabel?: string;
  status?: ReactNode;
  /** Primary workflow CTA (e.g. saleroom, publish) shown above quick links. */
  primaryAction?: ReactNode;
  children?: ReactNode;
};

/** Desktop context rail — metadata, primary action, and entity quick links. */
export function CatalogContextRail({
  entityId,
  updatedAt,
  publicHref,
  publicLabel,
  status,
  primaryAction,
  children,
}: Props) {
  return (
    <div className="space-y-4 lg:sticky lg:top-28">
      <CatalogInfoAside
        {...(entityId ? { entityId } : {})}
        {...(updatedAt ? { updatedAt } : {})}
        {...(publicHref ? { publicHref } : {})}
        {...(publicLabel ? { publicLabel } : {})}
        {...(status ? { status } : {})}
      >
        {primaryAction ? (
          <div className="space-y-2 border-t border-border-hairline pt-4">{primaryAction}</div>
        ) : null}
        {children ? (
          <div className="space-y-3 border-t border-border-hairline pt-4">{children}</div>
        ) : null}
      </CatalogInfoAside>
    </div>
  );
}
