import "server-only";

import { confirmSwitchHref, isHop } from "@/lib/navigation/account-link";
import { pathOf } from "@/lib/navigation/path-of";
import { isSameOriginNavigation } from "@/lib/security/fetch-metadata";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { recordHop } from "./account-hops";
import { type RecordKind, findRecordAccount } from "./remembered-account.server";

/** What a record page does next: render as it is, or load the hop that opens it in its account. */
export type OpenRecordOutcome = { kind: "render" } | { kind: "hop"; href: string };

/**
 * Sends a consignment or purchase page to the account the record belongs to, when that is not
 * the one in use: a link from an email opened in the personal account switches to the gallery.
 *
 * Switching writes the account cookie, so it must be a page load: the caller renders a `hop`
 * outcome as `AccountRestoreHop` (a `redirect()` here would be followed by the client router,
 * which keeps the old account's layout). A link that came from another site is never followed
 * silently: the person confirms the switch first. The explanations (no access, accounts
 * unavailable) change no cookie and redirect directly.
 */
export async function openRecordInItsAccount(input: {
  kind: RecordKind;
  id: string;
  actingId: string | null;
  next: string;
}): Promise<OpenRecordOutcome> {
  const owner = await findRecordAccount(input.kind, input.id);
  const target = recordHop(owner, input.actingId, input.next);
  if (!target) return { kind: "render" };
  if (!isHop(pathOf(target))) redirect(target);
  if (owner.kind === "ok" && !isSameOriginNavigation(await headers())) {
    redirect(confirmSwitchHref(owner.legalEntityId, input.next, "record"));
  }
  return { kind: "hop", href: target };
}
