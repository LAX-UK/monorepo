"use server";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getServerOrganisationActivity } from "@/lib/data/http/organisation-team.server";
import type { ActivityPageView, ActivityQuery } from "@/lib/data/http/organisation-team.types";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { memberChangeFailure } from "@/lib/legal-entity/member-change-errors";
import { CLIENT_ROUTES, teamHref } from "@/lib/navigation/client-routes";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { LegalEntityMemberRole } from "@auction/types";
import { revalidatePath } from "next/cache";
import { type TeamActionResult, teamActionFailure } from "./team-action-result";

type Send = {
  name: string;
  legalEntityId: string;
  path: string;
  method: "POST" | "PUT";
  body?: unknown;
  /** The pages that show what changed. */
  revalidate: readonly string[];
  /** How the refusal body reads; the API's own sentence by default. */
  failure?: (
    body: Record<string, unknown>,
    status: number,
  ) => { code: string | null; error: string };
};

/** Sends one change for the acting organisation and answers in words. */
async function send({
  name,
  legalEntityId,
  path,
  method,
  body,
  revalidate,
  failure = teamActionFailure,
}: Send): Promise<TeamActionResult> {
  return instrumentServerAction(name, async () => {
    const res = await authedServerFetch(path, {
      method,
      headers: {
        [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: false, ...failure(parsed, res.status) };
    }
    for (const path of revalidate) revalidatePath(path);
    return { ok: true };
  });
}

export type InvoiceDetailsInput = {
  billingEmail: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  } | null;
  poReference: string;
};

/** Saves the whole set of invoice details; an empty field means none. */
export async function saveInvoiceDetailsAction(
  legalEntityId: string,
  input: InvoiceDetailsInput,
): Promise<TeamActionResult> {
  return send({
    name: "saveInvoiceDetailsAction",
    legalEntityId,
    path: "/legal-entities/invoice-details",
    method: "PUT",
    body: input,
    revalidate: [CLIENT_ROUTES.organisation],
  });
}

export type ContactDetailsInput = { email: string; phone: string; website: string };

/** Saves the whole set of contact details; an empty field means none. */
export async function saveContactDetailsAction(
  legalEntityId: string,
  input: ContactDetailsInput,
): Promise<TeamActionResult> {
  return send({
    name: "saveContactDetailsAction",
    legalEntityId,
    path: "/legal-entities/contact-details",
    method: "PUT",
    body: input,
    revalidate: [CLIENT_ROUTES.organisation],
  });
}

/** Sets the organisation-wide bidding limit in pounds, or removes it with `null`. */
export async function setOrganisationBiddingLimitAction(
  legalEntityId: string,
  limit: number | null,
): Promise<TeamActionResult> {
  return send({
    name: "setOrganisationBiddingLimitAction",
    legalEntityId,
    path: "/legal-entities/bidding-limits/organisation",
    method: "PUT",
    body: { limit },
    revalidate: [teamHref("bidding"), CLIENT_ROUTES.settings],
  });
}

/** The person leaves the organisation; the last owner is refused with the reason. */
export async function leaveOrganisationAction(legalEntityId: string): Promise<TeamActionResult> {
  return send({
    name: "leaveOrganisationAction",
    legalEntityId,
    path: "/legal-entities/members/leave",
    method: "POST",
    revalidate: [CLIENT_ROUTES.organisations],
    failure: memberChangeFailure,
  });
}

/** Asks the owners and admins for a role, with why. */
export async function askForAccessAction(
  legalEntityId: string,
  input: { role: LegalEntityMemberRole; reason: string },
): Promise<TeamActionResult> {
  return send({
    name: "askForAccessAction",
    legalEntityId,
    path: "/legal-entities/access-requests",
    method: "POST",
    body: input,
    revalidate: [teamHref(), CLIENT_ROUTES.organisation],
  });
}

/** Approves a request (giving the role asked for, or the one chosen) or declines it. */
export async function decideAccessRequestAction(
  legalEntityId: string,
  requestId: string,
  decision: { kind: "approve"; role?: LegalEntityMemberRole } | { kind: "decline" },
): Promise<TeamActionResult> {
  const id = encodeURIComponent(requestId);
  return send({
    name: "decideAccessRequestAction",
    legalEntityId,
    path: `/legal-entities/access-requests/${id}/${decision.kind}`,
    method: "POST",
    body: decision.kind === "approve" && decision.role ? { role: decision.role } : {},
    revalidate: [teamHref(), teamHref("activity")],
  });
}

/** The member takes back their own request while it waits. */
export async function withdrawAccessRequestAction(
  legalEntityId: string,
  requestId: string,
): Promise<TeamActionResult> {
  return send({
    name: "withdrawAccessRequestAction",
    legalEntityId,
    path: `/legal-entities/access-requests/${encodeURIComponent(requestId)}/withdraw`,
    method: "POST",
    revalidate: [teamHref(), CLIENT_ROUTES.organisation],
  });
}

/** The next, older page of Activity for the same filters; `null` when it cannot be read. */
export async function loadOlderActivityAction(
  legalEntityId: string,
  query: ActivityQuery,
): Promise<ActivityPageView | null> {
  return instrumentServerAction("loadOlderActivityAction", () =>
    getServerOrganisationActivity(legalEntityId, query),
  );
}
