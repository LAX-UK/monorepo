import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import Image from "next/image";
import type { ReactNode } from "react";
import type { SaleHeroVM } from "./view-models";

type Props = {
  hero: SaleHeroVM;
  meta: ReactNode;
  toolbar: ReactNode;
  actions: ReactNode;
};

/**
 * Layout shell only: two-column hero (image | content). Slots for meta, toolbar, primary actions.
 * No business logic — OCP + SRP.
 */
export function SaleroomHero({ hero, meta, toolbar, actions }: Props) {
  return (
    <section className="bg-[#F1F1F3]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-8 py-8 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="relative aspect-[655/424] w-full shrink-0 overflow-hidden bg-[#0A0A0A] lg:w-[min(100%,655px)] lg:max-w-[655px]">
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
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950"
              aria-hidden
            >
              <span className="px-4 text-center text-lg font-semibold text-white/80">
                {hero.title}
              </span>
            </div>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-10">
          {meta}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">{toolbar}</div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-10">
              {actions}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
