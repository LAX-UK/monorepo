import { cn } from "@auction/ui";
import type { PageHeaderProps } from "@auction/ui/components/page-header";
import { pageTitleClass } from "@auction/ui/lax";
import type { ReactNode } from "react";

export type WorkspacePageHeaderProps = Omit<PageHeaderProps, "title"> & {
  title: ReactNode;
  meta?: ReactNode;
  listHeadingId?: string;
};

/**
 * The workspace page header (organisation workspace and staff areas): single h1 per page. On a
 * phone it is the large title, which the workspace bar takes over once the page scrolls past it.
 */
export function WorkspacePageHeader({
  meta,
  title,
  listHeadingId,
  className,
  description,
  breadcrumbs,
  actions,
}: WorkspacePageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6",
        "mb-0 border-0 pb-0",
        className,
      )}
    >
      <div className="w-full lg:flex-1 lg:pr-8">
        {breadcrumbs ? (
          <div className="mb-4 text-on-surface-variant [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline">
            {breadcrumbs}
          </div>
        ) : null}
        {meta ? <div className="mb-2 text-on-surface-variant">{meta}</div> : null}
        <h1 id={listHeadingId} className={pageTitleClass} data-page-title="">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-on-surface-variant">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
