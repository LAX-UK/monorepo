import { MarketingViewAllChevron, MarketingViewAllLink } from "@auction/marketing-ui";
import Link from "next/link";

type ShopViewAllLinkProps = {
  href: string;
  label: string;
};

export function ShopViewAllLink({ href, label }: ShopViewAllLinkProps) {
  const visible = label.replace(/\s*→\s*$/, "").trim();
  return (
    <MarketingViewAllLink asChild className="shop-home__section-action shop-focus-ring">
      <Link href={href} aria-label={label}>
        <span aria-hidden>{visible}</span>
        <MarketingViewAllChevron />
      </Link>
    </MarketingViewAllLink>
  );
}
