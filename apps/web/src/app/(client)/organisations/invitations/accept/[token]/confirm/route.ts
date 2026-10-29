import { bffConfig } from "@/lib/bff/config.server";
import { carryOutHop, hopUser, seeOther } from "@/lib/legal-entity/account-hop.server";
import { planJoinHop } from "@/lib/legal-entity/account-hops";
import { forgetMyCachedAccounts } from "@/lib/legal-entity/acting-context.server";
import { createInvitationLinkGateway } from "@/lib/legal-entity/invitation-link.gateway.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { isSameOriginWrite } from "@/lib/security/fetch-metadata";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The invitation page, where every outcome other than success is shown. */
function invitationPagePath(token: string): string {
  return `${CLIENT_ROUTES.invitations}/accept/${encodeURIComponent(token)}`;
}

/**
 * `POST /organisations/invitations/accept/<token>/confirm`: the invitation page's "Accept
 * invitation". Accepting happens only here, never while a page renders, so a prefetch or a
 * reload cannot use the invitation up. On success the hop opens the organisation's Home (the API
 * has just confirmed the membership), where the welcome card greets the new member; on anything else back to the page, which reads the invitation again and
 * says what happened ("You're already a member", "This invitation has expired").
 */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!isSameOriginWrite(request.headers, bffConfig().publicOrigin)) {
    return NextResponse.json(
      { error: "csrf_rejected" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const token = decodeURIComponent((await context.params).token);
  const pagePath = invitationPagePath(token);
  const signedIn = await hopUser(request, pagePath);
  if (signedIn instanceof Response) return signedIn;

  const outcome = await createInvitationLinkGateway().accept(token);
  if (outcome.kind === "unavailable") return seeOther(`${pagePath}?error=unavailable`);
  if (outcome.kind === "refused") return seeOther(pagePath);

  // The person's accounts just changed: the next read must include the organisation.
  await forgetMyCachedAccounts();
  return carryOutHop(planJoinHop(outcome.legalEntityId));
}
