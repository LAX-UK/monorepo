"use client";

import { CarouselDots } from "@auction/ui";

/**
 * Embla-synced dot toolbar for the home hero. Each dot is drawn at 10px inside a 24px target
 * (the fill is clipped to the content box), the smallest size WCAG 2.2 accepts.
 */
export function HeroDots() {
  return (
    <CarouselDots
      dotClassName="size-6 bg-clip-content p-[7px]"
      activeClassName="bg-brand-100"
      inactiveClassName="bg-brand-400/50 hover:bg-brand-300"
    />
  );
}
