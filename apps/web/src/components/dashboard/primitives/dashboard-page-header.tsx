import { cn } from "@auction/ui";
import { PageHeader, type PageHeaderProps } from "@auction/ui/components/page-header";
import type { ReactNode } from "react";

export type DashboardPageHeaderProps = PageHeaderProps & {
  meta?: ReactNode;
  /** `display` — larger welcome-style title on overview. */
  titleScale?: "default" | "display";
};

/** Opinionated dashboard page header — single h1 source per page. */
export function DashboardPageHeader({
  meta,
  titleScale = "default",
  className,
  ...props
}: DashboardPageHeaderProps) {
  const metaNode =
    meta && typeof meta === "string" ? (
      <span className="font-label text-[11px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        {meta}
      </span>
    ) : (
      meta
    );

  return (
    <PageHeader
      {...props}
      meta={metaNode}
      className={cn(
        "mb-0 border-0 pb-0",
        titleScale === "display" && "[&_h1]:text-3xl [&_h1]:md:text-4xl [&_h1]:tracking-tight",
        className,
      )}
    />
  );
}
