import "server-only";

import { getServerDataContainer } from "@/lib/data/container.server";

/**
 * The first artwork image of each lot the account has won, by lot id. The images are only
 * decoration, so a read that fails leaves the lots without thumbnails rather than the page without
 * its payment.
 */
export async function loadPayLotImages(
  lotIds: readonly string[],
): Promise<Record<string, string | null>> {
  try {
    const rows = await (await getServerDataContainer()).buying.purchases();
    const wanted = new Set(lotIds);
    return Object.fromEntries(
      rows
        .filter((row) => wanted.has(row.lot.id))
        .map((row) => [row.lot.id, row.lot.images[0] ?? null]),
    );
  } catch {
    return {};
  }
}
