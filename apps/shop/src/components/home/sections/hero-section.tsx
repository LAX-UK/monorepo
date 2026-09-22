import { HeroSectionClient } from "@/components/home/sections/hero-section.client";
import type { HomePageViewModel } from "@/lib/home/home-page.vm";

type HeroSectionProps = {
  hero: HomePageViewModel["hero"];
};

export function HeroSection({ hero }: HeroSectionProps) {
  return <HeroSectionClient hero={hero} />;
}
