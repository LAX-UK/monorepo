import "server-only";

import { cookies } from "next/headers";

import { getServerMyArtistFollows } from "./dashboard.server";

/** Public artist user ids the signed-in user watches (empty when logged out or on error). */
export async function getServerMyArtistWatchIds(): Promise<string[]> {
  const jar = await cookies();
  const cookie = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!cookie.trim()) return [];
  try {
    const rows = await getServerMyArtistFollows();
    return rows.map((r) => r.artistId);
  } catch {
    return [];
  }
}
