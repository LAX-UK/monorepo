import type { HeroSaleSlideVM } from "@/components/sections/home/home-view-models";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  slide: HeroSaleSlideVM;
  slideIndex: number;
  slideCount: number;
};

/** Pure presentation for one hero saleroom slide (no carousel logic). */
export function HeroSlideCopy({ slide, slideIndex, slideCount }: Props) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${slideIndex + 1} of ${slideCount}`}
      className="m-0 flex min-w-0 max-w-[684px] flex-col gap-8 border-0 p-0 md:gap-14"
    >
      <div className="flex flex-col gap-6">
        <LabelCaps className="text-base font-medium leading-6 tracking-normal text-white">
          {slide.modeBadge}
        </LabelCaps>
        <DisplayHeading
          as="h1"
          size="lg"
          className="font-medium uppercase leading-[120%] tracking-tight text-white md:text-[60px] md:leading-[72px]"
        >
          {slide.title}
        </DisplayHeading>
        <p className="font-body text-sm font-semibold uppercase tracking-wide text-white/90">
          {slide.dateLabel}
        </p>
      </div>
      <Button variant="cta" size="xl" className="pointer-events-auto min-h-[44px] w-fit" asChild>
        <Link href={slide.href}>Open saleroom</Link>
      </Button>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {slide.title}
      </p>
    </div>
  );
}
