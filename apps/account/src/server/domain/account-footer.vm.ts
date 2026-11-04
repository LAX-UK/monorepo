import type { SupportLinksVm } from "@/server/domain/account-links";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import { FOOTER_LEGAL, type MarketingFooterColumn } from "@auction/marketing-ui";

/**
 * The columns of LAX Account's footer, in the order every LAX footer uses: the other products,
 * help, then the legal links. Account is not listed among the products, since the person is on it.
 * Help and legal links are left out where the policies' home is not configured.
 */
export function buildAccountFooterColumns(
  products: readonly LaxFamilyLinkVm[],
  support: SupportLinksVm | null,
): MarketingFooterColumn[] {
  const columns: MarketingFooterColumn[] = [];

  const otherProducts = products
    .filter((product) => !product.current)
    .map(({ label, href }) => ({ label, href }));
  if (otherProducts.length > 0) {
    columns.push({ id: "lax-products", title: "LAX products", links: otherProducts });
  }

  if (support) {
    columns.push(
      {
        id: "help",
        title: "Help",
        links: [
          { label: "Help centre", href: support.helpCentre },
          { label: "Contact us", href: support.contact },
        ],
      },
      {
        id: "legal",
        title: FOOTER_LEGAL.columnTitle,
        links: [
          { label: FOOTER_LEGAL.terms, href: support.terms },
          { label: FOOTER_LEGAL.privacy, href: support.privacyPolicy },
        ],
      },
    );
  }

  return columns;
}
