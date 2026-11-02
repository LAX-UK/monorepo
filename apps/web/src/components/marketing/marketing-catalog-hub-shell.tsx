import {
  MarketingCatalogHubShell as BaseCatalogHubShell,
  type MarketingCatalogHubShellProps as BaseProps,
} from "@auction/marketing-ui";

export type MarketingCatalogHubShellProps = Omit<BaseProps, "as">;

/**
 * Catalogue hub shell for the Bid site. The site shell owns the page's single main landmark, so
 * this renders inside it as a plain container.
 */
export function MarketingCatalogHubShell(props: MarketingCatalogHubShellProps) {
  return <BaseCatalogHubShell as="div" {...props} />;
}
