import { AccountsUnavailable } from "@/components/layout/account-switcher/accounts-unavailable";
import { BidSiteChrome } from "@/components/layout/bid-site-chrome";
import { AccountArea } from "@auction/marketing-ui";

/**
 * The client area while the person's accounts cannot be read: the lax.bid frame with the retry
 * state and nothing account-specific. Neither the organisation workspace nor the personal pages
 * are drawn, because either would claim an account this request does not know.
 */
export function AccountsUnavailableFrame() {
  return (
    <BidSiteChrome>
      {/* The public header is fixed; the page starts below it. */}
      <div aria-hidden className="h-[var(--header-height)]" />
      <AccountArea>
        <AccountsUnavailable retry={{ kind: "refresh" }} />
      </AccountArea>
    </BidSiteChrome>
  );
}
