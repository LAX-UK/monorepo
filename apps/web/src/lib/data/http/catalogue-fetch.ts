import "server-only";

import {
  CATALOGUE_ARTISTS_TAG,
  CATALOGUE_HOME_TAG,
  CATALOGUE_LOTS_TAG,
  CATALOGUE_MEGA_MENU_TAG,
  CATALOGUE_PRESS_TAG,
  CATALOGUE_SALES_TAG,
} from "@/lib/data/cache-tags";
import {
  type ServerFetchPolicy,
  mergeFetchInitWithPolicy,
  revalidateFetchPolicy,
} from "@/lib/data/http/server-fetch-policy";

export const CATALOGUE_FETCH_POLICIES = {
  lots: revalidateFetchPolicy(60, [CATALOGUE_LOTS_TAG]),
  sales: revalidateFetchPolicy(60, [CATALOGUE_SALES_TAG]),
  home: revalidateFetchPolicy(60, [CATALOGUE_HOME_TAG]),
  artists: revalidateFetchPolicy(120, [CATALOGUE_ARTISTS_TAG]),
  megaMenu: revalidateFetchPolicy(300, [CATALOGUE_MEGA_MENU_TAG]),
  press: revalidateFetchPolicy(60, [CATALOGUE_PRESS_TAG]),
} as const satisfies Record<string, ServerFetchPolicy>;

export async function catalogueFetch(
  url: string,
  policy: ServerFetchPolicy,
  init?: RequestInit,
): Promise<Response> {
  return fetch(url, mergeFetchInitWithPolicy(policy, init));
}
