import "server-only";

import { getServerDataContainer } from "@/lib/data/container.server";
import { openRecordInItsAccount } from "@/lib/legal-entity/open-record-in-account.server";

/**
 * When the first lot of a link belongs to another account of this person, the address that opens
 * the link in that account (an emailed link opened in the wrong account); otherwise `null`.
 */
export async function payAccountHop(
  firstLotId: string | undefined,
  returnTo: string,
): Promise<string | null> {
  if (!firstLotId) return null;
  const scope = await (await getServerDataContainer()).buying.scope();
  const opened = await openRecordInItsAccount({
    kind: "purchase",
    id: firstLotId,
    actingId: scope.account.id,
    next: returnTo,
  });
  return opened.kind === "hop" ? opened.href : null;
}
