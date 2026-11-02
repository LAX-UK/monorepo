/** What the home page needs to know about a print photograph, read once on the server. */
export type ShopImageFacts = {
  width: number;
  height: number;
  /** Mean colour of the picture, 0 to 255 per channel. */
  mean: readonly [number, number, number];
};

/** Reads a photograph's size and colour; `null` when it cannot be read in time. */
export type ShopImageProbe = (src: string) => Promise<ShopImageFacts | null>;

/** How much of the print's colour reaches the field: enough to feel its own, pale enough for ink. */
const FIELD_TINT = 0.2;

function hex(channel: number): string {
  return Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, "0");
}

/**
 * The pale field the print sits on, taken from the print's own colour: white with a measure of the
 * mean mixed in. At this strength dark type passes AA on any print, from black to saturated.
 */
export function paleFieldFromMean(mean: ShopImageFacts["mean"]): string {
  const mixed = mean.map((channel) => 255 * (1 - FIELD_TINT) + channel * FIELD_TINT);
  return `#${mixed.map(hex).join("")}`;
}

/** Reads every address once, in parallel; an address that cannot be read is simply absent. */
export async function readImageFacts(
  probe: ShopImageProbe,
  sources: Iterable<string>,
): Promise<Map<string, ShopImageFacts>> {
  const unique = [...new Set(sources)];
  const entries = await Promise.all(unique.map(async (src) => [src, await probe(src)] as const));
  const facts = new Map<string, ShopImageFacts>();
  for (const [src, read] of entries) if (read) facts.set(src, read);
  return facts;
}
