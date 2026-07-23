import { CatalogDetailTabCard } from "@/components/admin/catalog/catalog-detail-tab-card";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  count?: number;
  actions?: ReactNode;
  toolbar?: ReactNode;
  addPanel?: ReactNode;
  /** Sticky save row shown only when the parent has unsaved changes. */
  saveBar?: ReactNode;
  /** Screen-reader reorder announcements and similar live updates. */
  liveRegion?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Shared collection shell for catalogue images, sale media, and editorial links.
 * Domain components keep ownership of persistence and validation.
 */
export function CatalogMediaWorkspace({
  title,
  description,
  count,
  actions,
  toolbar,
  addPanel,
  saveBar,
  liveRegion,
  children,
  footer,
  className,
}: Props) {
  return (
    <CatalogDetailTabCard
      title={title}
      {...(description ? { description } : {})}
      {...(count !== undefined ? { countBadge: count } : {})}
      {...(actions ? { actions } : {})}
      {...(toolbar ? { toolbar } : {})}
      {...(footer ? { footer } : {})}
      {...(className ? { className } : {})}
    >
      <div className={cn("space-y-5", addPanel ? "" : "pt-0")}>
        {addPanel ? (
          <div className="rounded-shell-card border border-border-hairline bg-surface-container-low/35 p-4 sm:p-5">
            {addPanel}
          </div>
        ) : null}
        {liveRegion}
        {children}
        {saveBar ? (
          <div className="sticky bottom-0 z-10 -mx-1 border-t border-border-hairline bg-surface/95 px-1 py-3 backdrop-blur-sm">
            {saveBar}
          </div>
        ) : null}
      </div>
    </CatalogDetailTabCard>
  );
}
