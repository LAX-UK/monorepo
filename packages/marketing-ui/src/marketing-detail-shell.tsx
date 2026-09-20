import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type MarketingDetailShellProps = {
  children: ReactNode;
  jsonLd?: ReactNode;
  wayfinding?: ReactNode;
  wayfindingClassName?: string;
  hero?: ReactNode;
  leadingChrome?: ReactNode;
  stickyChrome?: ReactNode;
  className?: string;
  shellClassName?: string;
  wrapChildren?: boolean;
  useCatalogPt?: boolean;
} & Omit<ComponentPropsWithoutRef<"main">, "children" | "className" | "id">;

/** Shared layout chrome for marketing detail pages. */
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
