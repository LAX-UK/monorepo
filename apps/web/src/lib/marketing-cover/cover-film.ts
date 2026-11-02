import type { CoverFilm } from "@auction/marketing-ui";
import type { Sale } from "@auction/types";
import { parseStreamEmbedUrl } from "@auction/validators";

/** What a film needs from the sale. */
export type CoverFilmSale = Pick<Sale, "title" | "heroPresentation" | "heroVideoUrl">;

/** Query parameters that make each provider start muted with captions on, once pressed. */
const START_PARAMS: Record<string, Record<string, string>> = {
  youtube: { autoplay: "1", mute: "1", cc_load_policy: "1", playsinline: "1", rel: "0" },
  vimeo: { autoplay: "1", muted: "1", texttrack: "en" },
};

/**
 * The film behind a video-presentation sale's "Play film" action. Only providers that can start
 * muted with captions qualify; anything else (a live stream, an unknown host) leaves the cover as
 * a plain poster, because a film must never start with sound.
 */
export function coverFilmFor(sale: CoverFilmSale): CoverFilm | null {
  if (sale.heroPresentation !== "video" || !sale.heroVideoUrl?.trim()) return null;
  const embed = parseStreamEmbedUrl(sale.heroVideoUrl);
  const params = embed ? START_PARAMS[embed.provider] : undefined;
  if (!embed || !params) return null;
  const url = new URL(embed.src);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return { src: url.toString(), title: `${sale.title}: film` };
}
