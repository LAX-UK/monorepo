import { MediaImage } from "@/components/ui/media-image";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { RelatedSaleVM } from "./view-models";

type Props = {
  sale: RelatedSaleVM;
};

/**
 * Full-width horizontal row: image | meta | Explore (Figma).
 */
export function SaleroomRelatedAuctionCard({ sale }: Props) {
  return (
    <li className="flex flex-col gap-6 border-b border-brand-100 py-8 dark:border-outline-variant/30 lg:flex-row lg:items-stretch lg:gap-6">
      <div className="relative h-[200px] w-full shrink-0 overflow-hidden bg-neutral-200 dark:bg-surface-container-high sm:h-[240px] lg:h-[300px] lg:w-[435px] lg:max-w-[435px]">
        <MediaImage
          src={sale.imageUrl}
          alt={sale.title}
          label="Auction cover"
          sizes="(max-width: 1024px) 100vw, 435px"
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-10">
        <div className="mx-auto flex w-full max-w-[460px] flex-col items-start gap-10 self-stretch">
          <p className="text-base uppercase leading-4 text-brand-500 dark:text-on-surface-variant">
            {sale.dateLine}
          </p>
          <div className="flex flex-col gap-4">
            <p className="text-base leading-4 text-brand-500 dark:text-on-surface-variant">
              {sale.kindLabel}
            </p>
            <h3 className="text-2xl font-semibold leading-6 text-brand-900 dark:text-on-surface">
              {sale.title}
            </h3>
            <p className="text-base uppercase leading-4 text-brand-500 dark:text-on-surface-variant">
              {sale.itemsLabel}
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            asChild
            variant="outline"
            className="h-10 min-w-[125px] rounded-[4px] border border-brand-800 bg-transparent font-['DM_Sans',sans-serif] text-base font-semibold tracking-[0.8px] text-brand-800 hover:bg-transparent dark:border-on-surface/80 dark:text-on-surface"
          >
            <Link href={sale.href}>Explore</Link>
          </Button>
        </div>
      </div>
    </li>
  );
}
