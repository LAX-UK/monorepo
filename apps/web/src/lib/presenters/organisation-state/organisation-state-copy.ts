import { supportMailto } from "@/lib/dashboard/dashboard-copy";
import { organisationHref } from "@/lib/navigation/client-routes";
import {
  type OrganisationBanner,
  type OrganisationBannerKey,
  type OrganisationBannerKind,
  type OrganisationBidReasonKey,
  type OrganisationHomeFirstRunKey,
  organisationBannerActors,
} from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";

/**
 * The words for the organisation-state policy (`organisationStatePolicy` in the domain). The
 * domain decides what each state allows and who is told what; this module only says it. Every
 * key has an entry, so a new key fails to compile until it has words.
 */

/** Names the organisation the copy is about. */
export type OrganisationStateCopyContext = { organisationName: string };

/** One way on from a notice: a page in the workspace, or writing to LAX. */
export type OrganisationStateLink = { label: string; href: string; kind: "page" | "contact" };

export type OrganisationBannerView = {
  kind: OrganisationBannerKind;
  /** Short, ends with a full stop; read inline before the line. */
  title: string;
  line: string;
  /** Offered only to people who can act on it, or to everyone when it is "Contact us". */
  action: OrganisationStateLink | null;
};

type BannerCopy = {
  title: string;
  /** What the state means, the same for everyone in the organisation. */
  line: (ctx: OrganisationStateCopyContext) => string;
  /** What the people who can act do about it. */
  act: OrganisationStateLink | null;
};

const CONTACT = (subject: string): OrganisationStateLink => ({
  label: "Contact us",
  href: supportMailto(subject),
  kind: "contact",
});

const BANNER_COPY: Record<OrganisationBannerKey, BannerCopy> = {
  documents_requested: {
    title: "Documents needed.",
    line: ({ organisationName }) =>
      `Bidding and selling for ${organisationName} open once we've checked them.`,
    act: { label: "Send documents", href: organisationHref("documents"), kind: "page" },
  },
  documents_under_review: {
    title: "Documents under review.",
    line: ({ organisationName }) =>
      `We're checking ${organisationName}'s documents, usually within 2–3 working days. Bidding and selling open once we're done.`,
    act: null,
  },
  payouts_not_set_up: {
    title: "Payouts not set up.",
    line: ({ organisationName }) =>
      `${organisationName}'s works can't go into a sale until a bank account is added for payouts.`,
    act: { label: "Set up payouts", href: organisationHref("payouts"), kind: "page" },
  },
  restricted: {
    title: "Bidding and selling paused.",
    line: ({ organisationName }) =>
      `${organisationName} can still see its history and pay its invoices. Contact us to find out more.`,
    act: CONTACT("Organisation paused"),
  },
  not_approved: {
    title: "Not approved.",
    line: ({ organisationName }) =>
      `We couldn't approve ${organisationName}. Contact us to find out what's needed.`,
    act: CONTACT("Organisation not approved"),
  },
  archived: {
    title: "Closed.",
    line: ({ organisationName }) =>
      `${organisationName} is closed. Its history stays here to read.`,
    act: CONTACT("Closed organisation"),
  },
};

/** Each role as one of several who may act: "an owner", "admin", "finance member". */
const ROLE_NOUN: Record<LegalEntityMemberRole, string> = {
  owner: "owner",
  admin: "admin",
  consignor: "consignor",
  finance: "finance member",
  buyer_agent: "buyer agent",
  viewer: "viewer",
};

/**
 * "An owner or admin", "An owner, admin or finance member"; `inside` for the middle of a
 * sentence ("waiting for an owner or admin").
 */
export function oneOfRoles(
  roles: readonly LegalEntityMemberRole[],
  position: "start" | "inside" = "start",
): string {
  const nouns = roles.map((role) => ROLE_NOUN[role]);
  const last = nouns.pop();
  if (!last) return "";
  const list = nouns.length > 0 ? `${nouns.join(", ")} or ${last}` : last;
  const article = /^[aeiou]/i.test(list) ? "an" : "a";
  return `${position === "start" ? article.replace(/^a/, "A") : article} ${list}`;
}

/** "An owner or admin can send them." for the people who are only told. */
const TOLD_ACTOR_VERB: Partial<Record<OrganisationBannerKey, string>> = {
  documents_requested: "can send them",
  payouts_not_set_up: "can add one",
};

function toldLine(key: OrganisationBannerKey, line: string): string {
  const verb = TOLD_ACTOR_VERB[key];
  const actors = organisationBannerActors(key);
  if (!verb || actors.length === 0) return line;
  return `${line} ${oneOfRoles(actors)} ${verb}.`;
}

/**
 * The banner as this member reads it. People who can act get the action; people who are only
 * told read who can act instead. "Contact us" is open to everyone.
 */
export function organisationBannerView(
  banner: OrganisationBanner,
  ctx: OrganisationStateCopyContext,
): OrganisationBannerView {
  const copy = BANNER_COPY[banner.key];
  const line = copy.line(ctx);
  const contact = copy.act?.kind === "contact" ? copy.act : null;
  return {
    kind: banner.kind,
    title: copy.title,
    line: banner.audience === "act" ? line : toldLine(banner.key, line),
    action: banner.audience === "act" ? copy.act : contact,
  };
}

/** The Home first-run card's words, before anything has happened. */
export type OrganisationFirstRunCopy = { title: string; description: string };

/** What a ready organisation's first step is; `none` when the role has no step to take. */
export type FirstRunStep = "sell" | "invite" | "none";

const READY_COPY: Record<
  FirstRunStep,
  (ctx: OrganisationStateCopyContext) => OrganisationFirstRunCopy
> = {
  sell: ({ organisationName }) => ({
    title: `Get ${organisationName} started`,
    description:
      "Send a first work to our specialists. Sales, payouts and bids show here as they happen.",
  }),
  invite: ({ organisationName }) => ({
    title: `Get ${organisationName} started`,
    description: "Invite your team. Sales, payouts and bids show here as they happen.",
  }),
  none: ({ organisationName }) => ({
    title: "Nothing here yet",
    description: `Sales, payouts and bids for ${organisationName} show here as they happen.`,
  }),
};

/**
 * Every first-run key. The banner above already says what the state is, so these say what this
 * page will show and when, without repeating it.
 */
const FIRST_RUN_COPY: Record<
  Exclude<OrganisationHomeFirstRunKey, "ready">,
  (ctx: OrganisationStateCopyContext) => OrganisationFirstRunCopy
> = {
  documents_requested: ({ organisationName }) => ({
    title: "Nothing here yet",
    description: `Sales, payouts and bids for ${organisationName} show here once its documents are checked.`,
  }),
  documents_under_review: ({ organisationName }) => ({
    title: "Nothing here yet",
    description: `Sales, payouts and bids for ${organisationName} show here once we've finished checking its documents.`,
  }),
  payouts_not_set_up: ({ organisationName }) => ({
    title: "Nothing here yet",
    description: `Bids and purchases for ${organisationName} show here as they happen. Works can go into a sale once payouts are set up.`,
  }),
  restricted: ({ organisationName }) => ({
    title: "Nothing here yet",
    description: `${organisationName}'s past sales, purchases and invoices show here.`,
  }),
  closed: ({ organisationName }) => ({
    title: "Nothing to show",
    description: `${organisationName} is closed, so nothing new will show here.`,
  }),
};

export function organisationFirstRunCopy(
  key: OrganisationHomeFirstRunKey,
  step: FirstRunStep,
  ctx: OrganisationStateCopyContext,
): OrganisationFirstRunCopy {
  return key === "ready" ? READY_COPY[step](ctx) : FIRST_RUN_COPY[key](ctx);
}

/** Why bidding for the organisation is closed, said before the person tries. */
export type OrganisationBidReasonCopy = { title: string; line: string };

const BID_REASON_COPY: Record<
  OrganisationBidReasonKey,
  (ctx: OrganisationStateCopyContext) => OrganisationBidReasonCopy
> = {
  documents_requested: ({ organisationName }) => ({
    title: `Bidding for ${organisationName} isn't open yet`,
    line: `It opens once ${organisationName} has sent its documents and we've checked them.`,
  }),
  documents_under_review: ({ organisationName }) => ({
    title: `Bidding for ${organisationName} isn't open yet`,
    line: `Bidding for ${organisationName} opens once we've checked its documents.`,
  }),
  restricted: ({ organisationName }) => ({
    title: `Bidding for ${organisationName} is paused`,
    line: "Contact us to find out more.",
  }),
  not_approved: ({ organisationName }) => ({
    title: `You can't bid for ${organisationName}`,
    line: `We couldn't approve ${organisationName} to bid.`,
  }),
  archived: ({ organisationName }) => ({
    title: `You can't bid for ${organisationName}`,
    line: `${organisationName} is closed.`,
  }),
};

export function organisationBidReasonCopy(
  key: OrganisationBidReasonKey,
  ctx: OrganisationStateCopyContext,
): OrganisationBidReasonCopy {
  return BID_REASON_COPY[key](ctx);
}
