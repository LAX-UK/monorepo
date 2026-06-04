import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";

type Props = {
  totalVolumeLabel: string;
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
      title="Past Auctions"
      titleSize="lg"
      description="An archival collection of distinguished sales and curated masterpieces. Explore our history of connecting collectors with extraordinary digital and physical assets."
      className="mb-20 !px-0 !py-0 md:!py-2"
      media={
        <div className="flex justify-start md:justify-end">
          <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-6 py-3 ring-1 ring-outline-variant/10">
            <span className="font-label text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
              Total volume
            </span>
            <span className="font-headline text-lg text-primary">{totalVolumeLabel}</span>
          </div>
        </div>
      }
    />
  );
}
