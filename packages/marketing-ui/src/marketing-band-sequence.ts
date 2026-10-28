/**
 * Page rhythm: tinted bands (cream feature, inverse, the gallery team panel) alternate with plain
 * sections and never sit next to each other. A page lists its sections in order with the surface
 * each would like; `resolveBandSequence` returns the surface each one actually gets.
 */
export type MarketingSectionSurface = "plain" | "band";

export type MarketingBandSection<Id extends string> = {
  id: Id;
  surface: MarketingSectionSurface;
  /**
   * A band that can also render on the plain surface (a promo or a link list). A fixed band (a
   * component that is always tinted) keeps its surface, so the band next to it gives way.
   */
  flexible: boolean;
};

export function resolveBandSequence<Id extends string>(
  sections: readonly MarketingBandSection<Id>[],
): Record<Id, MarketingSectionSurface> {
  const resolved = sections.map((section) => section.surface);
  for (let index = 1; index < sections.length; index++) {
    if (resolved[index] !== "band" || resolved[index - 1] !== "band") continue;
    if (sections[index]?.flexible) resolved[index] = "plain";
    else if (sections[index - 1]?.flexible) resolved[index - 1] = "plain";
  }
  return Object.fromEntries(
    sections.map((section, index) => [section.id, resolved[index] ?? section.surface]),
  ) as Record<Id, MarketingSectionSurface>;
}
