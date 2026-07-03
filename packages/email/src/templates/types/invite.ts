import type { TemplateDomainSlice } from "./shared.js";

const names = ["invite"] as const;

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
};

export const inviteTemplates = {
  names,
  vars: {} as InviteTemplateVars,
  recipientResolution: {
    /** Platform invites target addresses with no user row yet — worker must read `to_snapshot`. */
    invite: "snapshot",
  },
} satisfies TemplateDomainSlice<InviteTemplateName, InviteTemplateVars>;

export type { InviteTemplateName, InviteTemplateVars };
