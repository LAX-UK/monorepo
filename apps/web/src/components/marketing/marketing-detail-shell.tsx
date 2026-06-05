import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type MarketingDetailShellProps = {
  children: ReactNode;
  /** JSON-LD or other head scripts rendered at the top of `<main>`. */
  jsonLd?: ReactNode;
  /** Breadcrumbs / back link band (wrapped in `MARKETING_PAGE_SHELL` when set). */
  wayfinding?: ReactNode;
  wayfindingClassName?: string;
  /** Profile / saleroom hero above main content column. */
  hero?: ReactNode;
  /** Mobile sticky bars rendered at the top of `<main>` (e.g. sale summary). */
  leadingChrome?: ReactNode;
  /** Mobile sticky bars rendered inside `<main>` after main content. */
  stickyChrome?: ReactNode;
  className?: string;
  shellClassName?: string;
  /** When false, children render without an inner `MARKETING_PAGE_SHELL` wrapper. */
  wrapChildren?: boolean;
  /** When false, omits default `MARKETING_CATALOG_PT` (lot detail uses tighter header offset). */
  useCatalogPt?: boolean;
} & Omit<ComponentPropsWithoutRef<"main">, "children" | "className" | "id">;

/** Shared layout chrome for marketing detail pages (artist profile, sale, lot). */
export function MarketingDetailShell({
  children,
  jsonLd,
  wayfinding,
  wayfindingClassName,
  hero,
  leadingChrome,
  stickyChrome,
  className,
  shellClassName,
  wrapChildren = true,
  useCatalogPt = true,
  ...mainProps
}: MarketingDetailShellProps) {
  return (
    <main
      id="main-content"
      className={cn(
        useCatalogPt && MARKETING_CATALOG_PT,
        "bg-page-bg pb-[var(--page-bottom-padding)] dark:bg-background",
        className,
      )}
      {...mainProps}
    >
      {jsonLd}
      {leadingChrome}
      {wayfinding ? (
        <div className={cn(MARKETING_PAGE_SHELL, wayfindingClassName)}>{wayfinding}</div>
      ) : null}
      {hero}
      {wrapChildren ? (
        <div className={cn(MARKETING_PAGE_SHELL, shellClassName)}>{children}</div>
      ) : (
        children
      )}
      {stickyChrome}
    </main>
  );
}
