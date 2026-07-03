import "server-only";

import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import { profileAddressRowSchema } from "@/lib/data/http/addresses.schema";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";

/** Server-side fetcher for the current user's saved addresses.
 *
 * Returns an empty list on any failure so the dashboard chrome can render
 * without throwing.
 */
export async function getServerMyAddresses(): Promise<ProfileAddressRow[]> {
  try {
    const res = await authedServerFetch("/users/me/addresses");
    if (!res.ok) return [];
    const body = await readJsonBody(res);
    const { rows } = readListEnvelope(body, profileAddressRowSchema, "GET /users/me/addresses");
    return rows;
  } catch {
    return [];
  }
}
