import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";

type Props = {
  /** Sold hammer total; null hides the figure rather than showing a bare zero. */
  totalVolumeLabel: string | null;
};

export function PastAuctionsHeader({ totalVolumeLabel }: Props) {
  return (
    <MarketingPageHero
      breadcrumb={
        <MarketingBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Archive", current: true },
          ]}
          className={MARKETING_HUB_BREADCRUMB_CLASS}
        />
      }
      eyebrow="Archive"
      title="Past auctions"
      titleSize="lg"
      description="An archival collection of distinguished sales and curated masterpieces. Explore our history of connecting collectors with extraordinary digital and physical assets."
      className="mb-8 !px-0 !py-0 md:mb-10 md:!py-2"
      media={
        totalVolumeLabel ? (
          <div className="flex justify-start md:justify-end">
            <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-6 py-3 ring-1 ring-outline-variant/10">
              <span className="font-label text-xs font-medium text-on-surface-variant">
                Total volume
              </span>
              <span className="font-headline text-lg text-primary">{totalVolumeLabel}</span>
            </div>
          </div>
        ) : null
      }
    />
  );
}
