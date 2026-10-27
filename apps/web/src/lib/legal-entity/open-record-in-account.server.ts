import "server-only";

import { redirect } from "next/navigation";
import { recordHop } from "./account-hops";
import { type RecordKind, findRecordAccount } from "./remembered-account.server";

/**
 * Sends a consignment or purchase page to the account the record belongs to, when that is not
 * the one in use: a link from an email opened in the personal account switches to the gallery.
 * Returns when the page should render as it is.
 */
export async function openRecordInItsAccount(input: {
  kind: RecordKind;
  id: string;
  actingId: string | null;
  next: string;
}): Promise<void> {
  const owner = await findRecordAccount(input.kind, input.id).catch(
    () => ({ kind: "not_found" }) as const,
  );
  const target = recordHop(owner, input.actingId, input.next);
  if (target) redirect(target);
}
