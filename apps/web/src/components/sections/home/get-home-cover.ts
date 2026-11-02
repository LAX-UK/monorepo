import "server-only";

import { BETWEEN_SEASONS_COPY } from "@/components/sections/home/home-copy";
import {
  type HomeCover,
  type HomeCoverSale,
  type HomeCoverState,
  buildHomeCover,
  coverPlateLots,
} from "@/lib/marketing-cover/home-cover";
import { HOME_COVER_LINKS, HOME_COVER_NOTIFY_ACTION } from "@/lib/marketing-cover/home-cover-links";
import {
  DEFAULT_PLATE_FIELD,
  plateFieldFromPreview,
} from "@/lib/marketing-cover/lot-plate-field.server";
import { neutralCoverSlide } from "@auction/marketing-ui";
import type { Lot } from "@auction/types";

/** Shown when the sales could not be read: it claims nothing about any sale. */
const NEUTRAL_COVER = neutralCoverSlide({
  title: "Fine art auctions",
  fact: "Browse the lots coming up and the results of recent sales.",
  primary: { label: "Browse sales", href: "/sales" },
});

export function neutralHomeCover(): HomeCover {
  return { slides: [NEUTRAL_COVER], leadSale: null, lots: [] };
}

/** Reads each plate lot's colour once, in parallel, from its small preview. */
async function plateFields(lots: readonly Lot[]): Promise<Map<string, string>> {
  const entries = await Promise.all(
    lots.map(
      async (lot) =>
        [lot.id, await plateFieldFromPreview(lot.imageAssets?.[0]?.blurDataURL)] as const,
    ),
  );
  return new Map(entries);
}

/**
 * The home cover for the current state. The plate colours are read first (the only I/O), then the
 * cover is built by pure functions.
 */
export async function getHomeCover(input: {
  state: HomeCoverState;
  sales: readonly HomeCoverSale[];
  lotsBySale: ReadonlyMap<string, readonly Lot[]>;
  now: Date;
}): Promise<HomeCover> {
  const fields = await plateFields(coverPlateLots(input.state, input.sales, input.lotsBySale));
  return buildHomeCover({
    ...input,
    fieldFor: (lot) => fields.get(lot.id) ?? DEFAULT_PLATE_FIELD,
    links: HOME_COVER_LINKS,
    notifyAction: HOME_COVER_NOTIFY_ACTION,
    betweenSeasons: BETWEEN_SEASONS_COPY,
  });
}
