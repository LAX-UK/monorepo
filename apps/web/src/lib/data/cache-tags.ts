/** Next.js Data Cache tags for catalogue SSR fetches. */
export const CATALOGUE_LOTS_TAG = "catalogue-lots";
export const CATALOGUE_SALES_TAG = "catalogue-sales";
export const CATALOGUE_ARTISTS_TAG = "catalogue-artists";
export const CATALOGUE_HOME_TAG = "catalogue-home";
export const CATALOGUE_MEGA_MENU_TAG = "catalogue-mega-menu";
export const CATALOGUE_PRESS_TAG = "catalogue-press";

/*
 * Per-item tags for the public sale and lot pages. Every session-free read behind those pages
 * carries the tag of the lot or sale it shows, so a change to that one item (a new price, a status,
 * a close time, a withdrawal, a catalogue edit) drops exactly the cached reads that showed it.
 * The API and the worker send them to `POST /api/revalidate`; the names live in `@auction/domain`
 * so both sides agree.
 */
export {
  isPublicItemCacheTag as isPublicItemTag,
  publicLotCacheTag as publicLotTag,
  publicSaleCacheTag as publicSaleTag,
} from "@auction/domain";
