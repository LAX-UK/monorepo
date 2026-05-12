import "server-only";
import type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";

import { authedServerFetch } from "./authed-fetch.server";

/** Server-side fetcher for the current user's saved addresses.
 *
 * Returns an empty list on any failure so the dashboard chrome can render
 * without throwing.
 */
export async function getServerMyAddresses(): Promise<ProfileAddressRow[]> {
  try {
    const res = await authedServerFetch("/users/me/addresses");
    if (!res.ok) return [];
    const body = (await res.json()) as { data: ProfileAddressRow[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}
