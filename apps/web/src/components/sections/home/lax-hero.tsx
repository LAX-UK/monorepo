import type { HeroStateVM } from "@/components/sections/home/home-view-models";
import { LaxHeroLiveStream } from "@/components/sections/home/lax-hero-live-stream";
import { LaxHeroLot } from "@/components/sections/home/lax-hero-lot";
import { LaxHeroSaleroomRotator } from "@/components/sections/home/lax-hero-rotator";

type Props = {
  state: HeroStateVM;
  twitchParentHost: string;
};

export function LaxHero({ state, twitchParentHost }: Props) {
  switch (state.kind) {
    case "live":
      return <LaxHeroLiveStream vm={state} twitchParentHost={twitchParentHost} />;
    case "rotator":
      return <LaxHeroSaleroomRotator slides={state.slides} />;
    case "fallbackLot":
      return <LaxHeroLot lot={state.lot} />;
  }
}
