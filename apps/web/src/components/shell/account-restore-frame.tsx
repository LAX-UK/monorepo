import { AccountRestoreHop } from "@/components/layout/account-switcher/account-restore-hop";
import { BidSiteChrome } from "@/components/layout/bid-site-chrome";
import { AccountArea } from "@auction/marketing-ui/account/index";

/**
 * The client area while this browser is put in its account: the lax.bid frame with the restore
 * hop and nothing account-specific, since neither the workspace nor the personal pages are known
 * until the hop has run.
 */
export function AccountRestoreFrame({ href }: { href: string }) {
  return (
    <BidSiteChrome>
      {/* The public header is fixed; the page starts below it. */}
      <div aria-hidden className="h-[var(--header-height)]" />
      <AccountArea>
        <AccountRestoreHop href={href} />
      </AccountArea>
    </BidSiteChrome>
  );
}
