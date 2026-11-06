import "server-only";

import { isHop } from "@/lib/navigation/account-link";
import { redirect } from "next/navigation";
import { recordHop } from "./account-hops";
import { type RecordKind, findRecordAccount } from "./remembered-account.server";

/**
 * Sends a consignment or purchase page to the account the record belongs to, when that is not
 * the one in use: a link from an email opened in the personal account switches to the gallery.
 *
 * Switching writes the account cookie, so it must be a page load: the caller renders the returned
 * hop as `AccountRestoreHop` (a `redirect()` here would be followed by the client router, which
 * keeps the old account's layout). The explanations (no access, accounts unavailable) change no
 * cookie and redirect directly. Returns `null` when the page should render as it is.
 */
export async function openRecordInItsAccount(input: {
  kind: RecordKind;
  id: string;
  actingId: string | null;
  next: string;
}): Promise<string | null> {
  const owner = await findRecordAccount(input.kind, input.id);
  const target = recordHop(owner, input.actingId, input.next);
  if (!target) return null;
  if (isHop(target.split(/[?#]/)[0] ?? "")) return target;
  redirect(target);
}
