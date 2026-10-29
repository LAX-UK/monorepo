import { initials } from "@/components/organisations/initials";
import type { InvitationLinkPreview } from "@/lib/legal-entity/invitation-link.gateway.server";
import { switchAccountHref } from "@/lib/navigation/account-link";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { roleInSentence } from "@/lib/organisations/role-in-sentence";
import { formatDate } from "@/lib/ui/format";
import type { LaxIllustrationName } from "@auction/ui/components/lax-illustration";

type Link = { label: string; href: string };

/** What the invitation page shows for one state of the link. */
export type InvitationLinkView = {
  title: string;
  description: string;
  art: { kind: "illustration"; name: LaxIllustrationName } | { kind: "tile"; initials: string };
  /** "Accept invitation", posted to the accept route; only while the invitation is open. */
  accept: { label: string } | null;
  /** The main way on when there is nothing to accept ("Open Northbank Gallery"). */
  primary: Link | null;
  secondary: Link;
  /** Shown above the actions after an accept the API could not complete. */
  retryNotice: string | null;
};

const INVITATIONS: Link = { label: "Go to your invitations", href: CLIENT_ROUTES.invitations };

function openView(
  preview: Extract<InvitationLinkPreview, { state: "open" }>,
  failedBefore: boolean,
): InvitationLinkView {
  const who = preview.inviterName?.trim()
    ? `${preview.inviterName.trim()} invited you`
    : "You're invited";
  return {
    title: `Join ${preview.organisationName}`,
    description: `${who} to join ${preview.organisationName} as ${roleInSentence(preview.role)}. You can switch between it and your personal account at any time. This invitation expires on ${formatDate(preview.expiresAt)}.`,
    art: { kind: "tile", initials: initials(preview.organisationName) },
    accept: { label: "Accept invitation" },
    primary: null,
    secondary: { label: "Not now", href: CLIENT_ROUTES.invitations },
    retryNotice: failedBefore
      ? "We couldn't accept the invitation just now. Nothing has changed; try again in a moment."
      : null,
  };
}

/** Every state of an invitation link, in one table: a new state is one entry. */
const OUTCOME_VIEWS: {
  [S in Exclude<InvitationLinkPreview["state"], "open">]: (
    preview: Extract<InvitationLinkPreview, { state: S }>,
    pagePath: string,
  ) => InvitationLinkView;
} = {
  already_member: (preview) => ({
    title: `You're already a member of ${preview.organisationName}`,
    description: "There is nothing left to accept. You can open it any time from your accounts.",
    art: { kind: "tile", initials: initials(preview.organisationName) },
    accept: null,
    primary: {
      label: `Open ${preview.organisationName}`,
      href: switchAccountHref(preview.legalEntityId, CLIENT_ROUTES.home),
    },
    secondary: INVITATIONS,
    retryNotice: null,
  }),
  expired: (preview) => ({
    title: "This invitation has expired",
    description: `Ask the person who invited you to ${preview.organisationName} to send a new one.`,
    art: { kind: "illustration", name: "ticket" },
    accept: null,
    primary: null,
    secondary: INVITATIONS,
    retryNotice: null,
  }),
  closed: () => ({
    title: "This invitation is no longer open",
    description:
      "It may have been withdrawn or already used. Ask the person who invited you to send a new one.",
    art: { kind: "illustration", name: "ticket" },
    accept: null,
    primary: null,
    secondary: INVITATIONS,
    retryNotice: null,
  }),
  other_email: () => ({
    title: "This invitation is for another email address",
    description:
      "Sign in with the email address the invitation was sent to, then open the link again.",
    art: { kind: "illustration", name: "lock" },
    accept: null,
    primary: null,
    secondary: { label: "Go to Home", href: CLIENT_ROUTES.home },
    retryNotice: null,
  }),
  unavailable: (_preview, pagePath) => ({
    title: "We couldn't open this invitation",
    description:
      "Nothing has changed, and the invitation is still waiting for you. Try again in a moment.",
    art: { kind: "illustration", name: "askew" },
    accept: null,
    primary: { label: "Try again", href: pagePath },
    secondary: INVITATIONS,
    retryNotice: null,
  }),
};

/**
 * What the invitation page says for the link as the API read it. `failedBefore` is set when the
 * last accept could not reach the API, so the page asks the person to try once more.
 */
export function buildInvitationLinkView(input: {
  preview: InvitationLinkPreview;
  pagePath: string;
  failedBefore: boolean;
}): InvitationLinkView {
  const { preview, pagePath } = input;
  if (preview.state === "open") return openView(preview, input.failedBefore);
  const view = OUTCOME_VIEWS[preview.state] as (
    preview: InvitationLinkPreview,
    pagePath: string,
  ) => InvitationLinkView;
  return view(preview, pagePath);
}
