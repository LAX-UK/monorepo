import "server-only";

import {
  CATALOGUE_ARTISTS_TAG,
  CATALOGUE_HOME_TAG,
  CATALOGUE_LOTS_TAG,
  CATALOGUE_MEGA_MENU_TAG,
  CATALOGUE_PRESS_TAG,
  CATALOGUE_SALES_TAG,
} from "@/lib/data/cache-tags";
import { revalidateTag } from "next/cache";

/** Invalidate anonymous catalogue Data Cache tags after publish/admin mutations. */
export function revalidateCatalogueCache(): void {
  revalidateTag(CATALOGUE_LOTS_TAG);
  revalidateTag(CATALOGUE_SALES_TAG);
  revalidateTag(CATALOGUE_HOME_TAG);
  revalidateTag(CATALOGUE_ARTISTS_TAG);
  revalidateTag(CATALOGUE_MEGA_MENU_TAG);
  revalidateTag(CATALOGUE_PRESS_TAG);
}
