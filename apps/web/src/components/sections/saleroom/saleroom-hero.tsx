import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import Image from "next/image";
import type { ReactNode } from "react";
import type { SaleHeroVM } from "./view-models";

type Props = {
  hero: SaleHeroVM;
  headline: ReactNode;
  /** Right column: Figma “Overview” block. */
  overview: ReactNode;
  toolbar: ReactNode;
  actions: ReactNode;
};

/**
 * Layout shell: left column = headline + image; right = overview, toolbar, actions (Figma 1440).
 * Mobile: stacked headline → image → overview → toolbar → actions.
 */
export function SaleroomHero({ hero, headline, overview, toolbar, actions }: Props) {
  return (
    <section className="bg-page-bg dark:bg-background">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 p-8 lg:flex-row lg:gap-6">
        <div className="flex w-full shrink-0 flex-col gap-6 lg:w-[655px]">
          {headline}
          <div className="relative aspect-[655/424] w-full overflow-hidden bg-[#E5E5E5] dark:bg-surface-container-high">
            {hero.coverImage ? (
              <Image
                src={hero.coverImage}
                alt={hero.title}
                fill
                priority
                placeholder="blur"
                blurDataURL={TINY_IMAGE_BLUR}
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 655px"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-surface-container-highest dark:to-surface-dim"
                aria-hidden
              >
                <span className="px-4 text-center text-lg font-semibold text-neutral-700 dark:text-on-surface-variant">
                  {hero.title}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-end gap-10 lg:items-end">
          <div className="flex w-full flex-col gap-10 lg:items-end">
            {overview}
            <div className="flex w-full min-w-0 justify-end">{toolbar}</div>
          </div>
          {actions}
        </div>
      </div>
    </section>
  );
}
