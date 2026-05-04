import type { HeroSaleSlideVM } from "@/components/sections/home/home-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { RevealOnMount } from "@/components/ui/reveal";
import { DisplayHeading, LabelCaps, LiveDot } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

type Props = {
  sale: HeroSaleSlideVM;
  isLive?: boolean;
};

export function LaxHeroEditorial({ sale, isLive = false }: Props) {
  return (
    <section className="flex min-h-[min(100svh,720px)] w-full flex-col bg-brand-900 pt-[var(--header-height)] lg:flex-row">
      <div className="flex w-full flex-col justify-end gap-8 bg-brand-900 px-6 py-12 md:px-10 md:py-16 lg:w-[480px] lg:px-14">
        <div className="fade-up flex items-center gap-2">
          {isLive ? <LiveDot className="live-dot-pulse h-2 w-2" /> : null}
          <LabelCaps className={isLive ? "text-live-red" : "text-white/45"}>
            {isLive ? "Live Now" : "Opening Soon"}
          </LabelCaps>
        </div>
        <DisplayHeading
          as="h1"
          className="fade-up-d1 text-4xl font-medium uppercase leading-[1.1] text-[#f1f1f3] md:text-5xl"
        >
          {sale.title}
        </DisplayHeading>
        <p className="fade-up-d2 font-body text-sm leading-relaxed text-white/45">
          {sale.dateLabel}
        </p>
        <div className="fade-up-d3 flex flex-col gap-3">
          <Button variant="secondary" size="xl" asChild>
            <Link href="/register" className="inline-flex items-center justify-center gap-2">
              Register to Bid
              <ArrowRight className="size-5" aria-hidden />
            </Link>
          </Button>
          <Link
            href={sale.href}
            className="font-body text-sm font-semibold tracking-wide text-white/45 transition-colors hover:text-white"
          >
            View Catalogue →
          </Link>
        </div>
      </div>
      <RevealOnMount className="zoom-bg relative min-h-[480px] flex-1 overflow-hidden">
        <MediaImage
          src={sale.coverImageUrl}
          alt={sale.coverImageAlt}
          label="Auction cover"
          tone="dark"
          priority
          sizes="(max-width: 1024px) 100vw, calc(100vw - 480px)"
        />
      </RevealOnMount>
    </section>
  );
}
