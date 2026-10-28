import {
  type MarketingBandSection,
  type MarketingSectionSurface,
  resolveBandSequence,
} from "@auction/marketing-ui";

/** The surface a page section asks for, and whether it can give way to a neighbouring band. */
export type ShopSectionSurfaceRule<Id extends string> = Omit<MarketingBandSection<Id>, "id">;

export type ShopPageSections<Id extends string> = {
  /** The sections shown, in page order; a hidden section is left out, so it leaves no gap. */
  sections: Id[];
  /**
   * The surface each section renders on, recomputed from the sections shown so two tinted bands
   * never sit together. A hidden section keeps the surface it asked for; nothing renders it.
   */
  surfaces: Record<Id, MarketingSectionSurface>;
};

/**
 * One page's rhythm, from its sections in order (the `rules` table's key order) and which of
 * them have something to show. The alternation itself is the family rule lax.art uses.
 */
export function resolveShopPageSections<Id extends string>(
  rules: Readonly<Record<Id, ShopSectionSurfaceRule<Id>>>,
  shown: Readonly<Record<Id, boolean>>,
): ShopPageSections<Id> {
  const order = Object.keys(rules) as Id[];
  const sections = order.filter((id) => shown[id]);
  const asked = Object.fromEntries(order.map((id) => [id, rules[id].surface])) as Record<
    Id,
    MarketingSectionSurface
  >;
  return {
    sections,
    surfaces: {
      ...asked,
      ...resolveBandSequence(sections.map((id) => ({ id, ...rules[id] }))),
    },
  };
}
