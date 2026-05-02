import type { SaleCalendarRowVM } from "@/components/sections/sales/sales-view-models";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { AspectRatio, DisplayHeading, Separator } from "@auction/ui";
import Image from "next/image";
import Link from "next/link";

type Props = {
  vm: SaleCalendarRowVM;
};

export function SaleCalendarRow({ vm }: Props) {
  const statusTone =
    vm.status === "active"
      ? "bg-live-red/10 text-live-red"
      : vm.status === "scheduled"
        ? "bg-primary/10 text-primary"
        : "bg-brand-300/10 text-brand-300";

  return (
    <li>
      <Link
        href={vm.href}
        className="grid gap-4 py-8 transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:grid-cols-[200px_1fr_auto] md:gap-8"
      >
        <div className="relative h-[220px] overflow-hidden rounded bg-surface-container-low md:h-[130px]">
          <AspectRatio ratio={200 / 130} className="relative size-full overflow-hidden">
            {vm.coverImageUrl ? (
              <Image
                src={vm.coverImageUrl}
                alt={vm.coverImageAlt}
                fill
                placeholder="blur"
                blurDataURL={TINY_IMAGE_BLUR}
                className="object-cover transition-transform duration-700 motion-safe:hover:scale-105"
                sizes="(max-width: 768px) 100vw, 200px"
              />
            ) : (
              <ImagePlaceholder label="Auction cover" />
            )}
          </AspectRatio>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-body text-xs uppercase tracking-[0.1em] text-brand-300">
              {vm.dateLabel}
            </p>
            <span
              className={`rounded-full px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-[0.1em] ${statusTone}`}
            >
              {vm.status}
            </span>
          </div>
          <DisplayHeading
            as="h2"
            className="text-2xl font-semibold leading-tight text-brand-900 dark:text-on-surface"
          >
            {vm.title}
          </DisplayHeading>
          <p className="font-body text-sm text-brand-300">
            {vm.itemsLabel} · {vm.auctionTypeLabel}
          </p>
        </div>

        <div className="pt-1 md:text-right">
          <span className="font-label text-xs font-semibold uppercase tracking-[0.06em] text-primary">
            {vm.status === "ended" ? "View results →" : "View sale →"}
          </span>
        </div>
      </Link>
      <Separator className="bg-outline-variant/40" />
    </li>
  );
}
