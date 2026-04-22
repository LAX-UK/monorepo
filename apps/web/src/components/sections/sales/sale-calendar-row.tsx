import type { SaleCalendarRowVM } from "@/components/sections/sales/sales-view-models";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { AspectRatio, Button, DisplayHeading, Separator } from "@auction/ui";
import Image from "next/image";
import Link from "next/link";

type Props = {
  vm: SaleCalendarRowVM;
};

export function SaleCalendarRow({ vm }: Props) {
  return (
    <li>
      <div className="flex flex-col gap-6 py-8 lg:h-[364px] lg:flex-row lg:items-start lg:gap-6">
        <Link
          href={vm.href}
          className="block w-full shrink-0 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:w-[435px]"
        >
          <AspectRatio
            ratio={435 / 300}
            className="relative w-full overflow-hidden bg-surface-container-low"
          >
            {vm.coverImageUrl ? (
              <Image
                src={vm.coverImageUrl}
                alt={vm.coverImageAlt}
                fill
                placeholder="blur"
                blurDataURL={TINY_IMAGE_BLUR}
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 435px"
              />
            ) : (
              <div
                className="flex size-full items-center justify-center bg-surface-container-high font-label text-xs uppercase tracking-widest text-on-surface-variant"
                aria-hidden
              >
                No cover
              </div>
            )}
          </AspectRatio>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-10 lg:min-h-[300px] lg:gap-10">
          <div className="flex min-w-0 max-w-full flex-col gap-10">
            <p className="font-body text-base font-normal uppercase leading-4 text-brand-500 dark:text-on-surface-variant">
              {vm.dateLabel}
            </p>
            <div className="flex min-w-0 max-w-full flex-col gap-4">
              <p className="font-body text-base font-normal leading-4 text-brand-500 dark:text-on-surface-variant">
                {vm.auctionTypeLabel}
              </p>
              <DisplayHeading
                as="h2"
                className="text-2xl font-semibold leading-6 text-brand-900 dark:text-on-surface"
              >
                <Link href={vm.href} className="hover:underline">
                  {vm.title}
                </Link>
              </DisplayHeading>
              <p className="font-body text-base font-normal uppercase leading-4 text-brand-500 dark:text-on-surface-variant">
                {vm.itemsLabel}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col items-end">
            <Button
              variant="outline"
              asChild
              className="h-10 w-[125px] rounded border border-brand-800 bg-transparent px-8 py-[18px] font-headline text-base font-semibold leading-6 tracking-[0.05em] text-brand-800 hover:bg-brand-800/5 dark:border-on-surface dark:text-on-surface"
            >
              <Link href={vm.href}>Browse</Link>
            </Button>
          </div>
        </div>
      </div>
      <Separator className="bg-brand-100 dark:bg-outline-variant/40" />
    </li>
  );
}
