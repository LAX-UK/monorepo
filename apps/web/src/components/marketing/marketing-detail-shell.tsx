import {
  MarketingDetailShell as BaseDetailShell,
  type MarketingDetailShellProps as BaseProps,
} from "@auction/marketing-ui";

export type MarketingDetailShellProps = Omit<BaseProps, "as">;

/**
 * Detail shell for the Bid site. The site shell owns the page's single main landmark, so this
 * renders inside it as a plain container.
 */
export function MarketingDetailShell(props: MarketingDetailShellProps) {
  return <BaseDetailShell as="div" {...props} />;
}
