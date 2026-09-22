import { MarketingFooterSocials } from "@auction/marketing-ui";

const socialClass =
  "h-6 w-6 text-brand-800 transition-opacity hover:opacity-70 dark:text-on-surface";

export function FooterSocials() {
  return <MarketingFooterSocials linkClassName={socialClass} />;
}
