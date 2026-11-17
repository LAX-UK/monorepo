import { ArtFooterAccountList } from "@/components/layout/art-footer-account-list.client";
import { ArtFooterLink } from "@/components/layout/art-footer-link";
import { ART_FOOTER_ACCOUNT_COLUMN_ID, type ArtFooterVm } from "@/lib/layout/art-footer.vm";
import { FOCUS_RING, productCopyrightLine } from "@auction/branding";
import { LaxLogo, MarketingFooter, MarketingFooterSocials } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

type ArtFooterProps = {
  vm: ArtFooterVm;
};

/** Drawn on the server; only the Account list, which follows the visitor, is drawn in the browser. */
export function ArtFooter({ vm }: ArtFooterProps) {
  const columns = vm.columns.map((column) =>
    column.id === ART_FOOTER_ACCOUNT_COLUMN_ID
      ? { ...column, list: <ArtFooterAccountList /> }
      : column,
  );
  return (
    <MarketingFooter
      logo={
        <Link href="/" className={cn("inline-flex", FOCUS_RING)} aria-label="lax.art home">
          <LaxLogo className="art-footer__logo" />
        </Link>
      }
      columns={columns}
      socials={<MarketingFooterSocials product="art" />}
      copyright={productCopyrightLine("art")}
      renderLink={(link) => <ArtFooterLink link={link} />}
    />
  );
}
