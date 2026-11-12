import type { ShopStaffCapability } from "./staff-capabilities.js";

/**
 * The picture that leads the Shop home's first screen. Choosing or removing it changes the public
 * home at once, so it needs the capability that publishes editorial content, the same as the
 * featured lists beside it. Reading it needs none: it shows only what the home already shows.
 */
export const HOME_COVER_EDIT_CAPABILITY: ShopStaffCapability = "editorial.publish";
