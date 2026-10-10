import type { TemplateDomainSlice } from "./shared.js";

const names = ["invite", "access-invite"] as const;

type InviteTemplateName = (typeof names)[number];

type InviteTemplateVars = {
  invite: {
    inviteUrl: string;
    inviterName?: string | null;
    inviteeEmail: string;
    role?: string | null;
    /** When inviting platform staff, internal specialization label for copy. */
    staffRole?: string | null;
    expiresAt?: string | null;
  };
  /** LAX-wide invitation: staff roles per platform or membership of an organisation. */
  "access-invite": {
    scope: "staff" | "organisation";
    orgName?: string | null;
    inviterName?: string | null;
    inviteeEmail: string;
    /** One row per platform (staff) or the organisation role (organisation). */
    grants: { platform: string; role: string; summary?: string | null }[];
    /** Existing accounts accept after sign-in; new addresses create an account first. */
    existingAccount: boolean;
    actionUrl: string;
    expiresAt?: string | null;
  };
};

export const inviteTemplates = {
  names,
  vars: {} as InviteTemplateVars,
  recipientResolution: {
    /** Platform invites target addresses with no user row yet — worker must read `to_snapshot`. */
    invite: "snapshot",
    "access-invite": "snapshot",
  },
} satisfies TemplateDomainSlice<InviteTemplateName, InviteTemplateVars>;

export type { InviteTemplateName, InviteTemplateVars };
