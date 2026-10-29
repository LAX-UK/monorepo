import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { LegalEntityMemberRole } from "@auction/types";
import { z } from "zod";

/** What an invitation link is for the signed-in person who opened it (see the API's preview). */
export type InvitationLinkPreview =
  | {
      state: "open";
      legalEntityId: string;
      organisationName: string;
      role: LegalEntityMemberRole;
      inviterName: string | null;
      expiresAt: string;
    }
  | { state: "already_member"; legalEntityId: string; organisationName: string }
  | { state: "expired"; organisationName: string }
  | { state: "closed" }
  | { state: "other_email" }
  /** The API could not answer; nothing is known about the invitation. */
  | { state: "unavailable" };

/** What accepting did. Every refusal is shown by reading the link again (see `preview`). */
export type InvitationAcceptOutcome =
  | { kind: "accepted"; legalEntityId: string }
  | { kind: "refused" }
  | { kind: "unavailable" };

export interface IInvitationLinkGateway {
  /** Reads the link; changes nothing. */
  preview(token: string): Promise<InvitationLinkPreview>;
  /** Accepts the invitation for the signed-in person. */
  accept(token: string): Promise<InvitationAcceptOutcome>;
}

const previewSchema = z.object({
  data: z.discriminatedUnion("state", [
    z.object({
      state: z.literal("open"),
      legalEntityId: z.string(),
      organisationName: z.string(),
      role: z.string(),
      inviterName: z.string().nullable(),
      expiresAt: z.string(),
    }),
    z.object({
      state: z.literal("already_member"),
      legalEntityId: z.string(),
      organisationName: z.string(),
    }),
    z.object({ state: z.literal("expired"), organisationName: z.string() }),
    z.object({ state: z.literal("closed") }),
    z.object({ state: z.literal("other_email") }),
  ]),
});

const acceptedSchema = z.object({ data: z.object({ legalEntityId: z.string() }) });

type Fetcher = typeof authedServerFetch;

function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  };
}

/** Invitation links over the Bid API. Failures are typed, never mistaken for an answer. */
export function createInvitationLinkGateway(
  fetcher: Fetcher = authedServerFetch,
): IInvitationLinkGateway {
  return {
    async preview(token) {
      try {
        const res = await fetcher("/legal-entities/invitations/preview", jsonPost({ token }));
        if (!res.ok) return { state: "unavailable" };
        const parsed = previewSchema.safeParse(await res.json().catch(() => null));
        if (!parsed.success) return { state: "unavailable" };
        const data = parsed.data.data;
        return data.state === "open" ? { ...data, role: data.role as LegalEntityMemberRole } : data;
      } catch {
        return { state: "unavailable" };
      }
    },

    async accept(token) {
      try {
        const res = await fetcher("/legal-entities/invitations/accept", jsonPost({ token }));
        if (res.ok) {
          const parsed = acceptedSchema.safeParse(await res.json().catch(() => null));
          return parsed.success
            ? { kind: "accepted", legalEntityId: parsed.data.data.legalEntityId }
            : { kind: "unavailable" };
        }
        // 4xx: the invitation said no (expired, withdrawn, already a member, another email).
        return res.status >= 400 && res.status < 500 && res.status !== 429
          ? { kind: "refused" }
          : { kind: "unavailable" };
      } catch {
        return { kind: "unavailable" };
      }
    },
  };
}
