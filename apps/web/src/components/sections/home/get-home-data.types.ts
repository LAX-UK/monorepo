import type { HomeHangVM } from "@/lib/hang/home-hang";
import type { HomeSections } from "@/lib/home-sections/types";
import type { HomeCover } from "@/lib/marketing-cover/home-cover";
import type { HomeStateResult } from "@auction/domain";
import type { Sale } from "@auction/types";

/** Minimal shape for `itemList` JSON-LD when there are no upcoming sales. */
export type HomeJsonLdListEntry = { title: string; href: string };

export type HomePageData = {
  /** Which content state the page is in, with its section order and lead sale. */
  homeState: HomeStateResult;
  /** The works hung under the hero; `null` when fewer than two have photographs. */
  hang: HomeHangVM | null;
  /** The cover slides, built for a visitor who is not signed in. */
  cover: HomeCover;
  /** Every section below the hang that has something to show, keyed by section. */
  sections: HomeSections;
  /** Lots promoted for structured data when there are no upcoming sales. */
  jsonLdListFallback: HomeJsonLdListEntry[];
  /** First N sales (for Event-rich JSON-LD). */
  upcomingSales: Sale[];
  isAuthenticated: boolean;
};
