import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type MarketingCatalogHubShellProps = {
  children: ReactNode;
  /** Full-bleed hero above the inner catalogue column (e.g. MarketingPageHero). */
  hero?: ReactNode;
  /** Sticky toolbar band inside the inner shell (filters, count, sort). */
  toolbar?: ReactNode;
  /** Pagination or footer actions below main content. */
  footer?: ReactNode;
  /** JSON-LD or other head scripts rendered at the top of `<main>`. */
  jsonLd?: ReactNode;
  className?: string;
  shellClassName?: string;
} & Omit<ComponentPropsWithoutRef<"main">, "children" | "className" | "id">;

/** Shared layout chrome for marketing catalogue hubs (`/search`, `/archive`, `/artists`). */
export function MarketingCatalogHubShell({
  children,
  hero,
  toolbar,
  footer,
  jsonLd,
  className,
  shellClassName,
  ...mainProps
}: MarketingCatalogHubShellProps) {
  return (
    <main
      id="main-content"
      className={cn(
        MARKETING_CATALOG_PT,
        "bg-page-bg pb-[var(--page-bottom-padding)] text-on-surface dark:bg-background",
        className,
      )}
      {...mainProps}
    >
      {jsonLd}
      {hero}
      <div className={cn(MARKETING_PAGE_SHELL, shellClassName)}>
        {toolbar}
        {children}
        {footer}
      </div>
    </main>
  );
}
