"use client";

import { CarouselDots } from "@auction/ui";

/** Embla-synced dot toolbar for the home hero. */
export function HeroDots() {
  return (
    <CarouselDots
      activeClassName="bg-brand-100"
      inactiveClassName="bg-brand-400/50 hover:bg-brand-300"
    />
  );
}
