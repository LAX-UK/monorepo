import { FooterAccountList } from "@/components/layout/footer-account-list";
import { FooterLink } from "@/components/layout/footer-link";
import {
  BID_FOOTER_ACCOUNT_COLUMN_ID,
  buildBidFooterColumns,
} from "@/components/layout/footer-link-groups";
import { FooterSocials } from "@/components/layout/footer-socials";
import { LaxLogo } from "@/components/layout/lax-logo";
import { productCopyrightLine } from "@/lib/brand";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { MarketingFooter } from "@auction/marketing-ui/marketing-footer";
import { cn } from "@auction/ui/lib/utils";
import Link from "next/link";

type SiteFooterProps = {
  /** Cross-product wayfinding (validated at composition root). */
  crossProductLinks?: LaxProductLinkVm[];
};

/**
 * The Bid footer, drawn on the server so none of it is in the page's scripts. The pieces that
 * need the browser are small islands: the Account list (it follows the session), the link that
 * marks the current page, the cookie settings button and the phone sections that fold away.
 */
export function SiteFooter({ crossProductLinks = [] }: SiteFooterProps = {}) {
  const columns = buildBidFooterColumns(crossProductLinks).map((column) =>
    column.id === BID_FOOTER_ACCOUNT_COLUMN_ID
      ? { ...column, list: <FooterAccountList /> }
      : column,
  );
  return (
    <MarketingFooter
      headingId="bid-footer-heading"
      logo={
        <Link href="/" className={cn("inline-flex", FOCUS_RING)} aria-label="LAX Bid home">
          <LaxLogo variant="footer" />
        </Link>
      }
      columns={columns}
      socials={<FooterSocials />}
      copyright={productCopyrightLine("bid")}
      renderLink={(link) => <FooterLink link={link} />}
    />
  );
}
