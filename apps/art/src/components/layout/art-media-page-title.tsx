import { ArtHeroSignal } from "@/components/header/art-hero-signal.client";
import { ART_HERO_UNDER_HEADER_CLASS } from "@/lib/layout/art-header-chrome.vm";
import { MarketingPageTitle, type MarketingPageTitleProps } from "@auction/marketing-ui";
import { cn } from "@auction/ui";

type ArtMediaPageTitleProps = Extract<MarketingPageTitleProps, { variant: "media" }>;

/** The shared media title band, extended up under the transparent header. */
export function ArtMediaPageTitle({ className, ...props }: ArtMediaPageTitleProps) {
  return (
    <>
      <ArtHeroSignal />
      <MarketingPageTitle {...props} className={cn(ART_HERO_UNDER_HEADER_CLASS, className)} />
    </>
  );
}
