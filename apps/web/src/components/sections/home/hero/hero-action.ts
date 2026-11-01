import type { HeroSaleSlideVM } from "@/components/sections/home/home-view-models";

export type HeroAction = { label: string };

/**
 * The hero's one action follows the kind of sale. A live or hybrid sale that is in session sends
 * people into the saleroom; every other sale, timed online or not yet open, shows its lots.
 */
export function heroAction(slide: Pick<HeroSaleSlideVM, "deliveryMode" | "status">): HeroAction {
  const hasRoom = slide.deliveryMode === "hybrid" || slide.deliveryMode === "onsite";
  return slide.status === "active" && hasRoom
    ? { label: "Join the saleroom" }
    : { label: "View lots" };
}
