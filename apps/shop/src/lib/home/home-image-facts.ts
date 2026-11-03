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

/** The dark theme's surface ink the deep field is mixed toward. */
const DARK_INK = [24, 26, 26] as const;
/** How much of the print's colour the deep field keeps. */
const DEEP_KEEP = 0.22;

/**
 * The deep field the print sits on in the dark theme: its mean colour mixed toward the dark
 * surface ink, so it reads as a deep mat of the print's own hue. White type reaches AA on it for
 * any print, white included.
 */
export function deepFieldFromMean(mean: ShopImageFacts["mean"]): string {
  const mixed = mean.map(
    (channel, i) => (DARK_INK[i] ?? 0) * (1 - DEEP_KEEP) + channel * DEEP_KEEP,
  );
  return `#${mixed.map(hex).join("")}`;
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
