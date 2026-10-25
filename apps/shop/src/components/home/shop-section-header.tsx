import { ShopViewAllLink } from "@/components/home/shop-view-all-link";
import { MarketingSectionHeader } from "@auction/marketing-ui";
import { DisplayHeading } from "@auction/ui";

type ShopSectionHeaderProps = {
  headingId: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
};

export function ShopSectionHeader({
  headingId,
  title,
  subtitle,
  actionLabel,
  actionHref,
}: ShopSectionHeaderProps) {
  return (
    <MarketingSectionHeader
      className="shop-home__section-header"
      headingBlockClassName="shop-home__section-heading-block"
      subtitleClassName="shop-home__section-subtitle"
      heading={
        <DisplayHeading as="h2" id={headingId} size="sm" className="shop-home__section-title">
          {title}
        </DisplayHeading>
      }
      subtitle={subtitle}
      action={
        actionHref && actionLabel ? <ShopViewAllLink href={actionHref} label={actionLabel} /> : null
      }
    />
  );
}
