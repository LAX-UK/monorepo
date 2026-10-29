import { supportMailto } from "@/lib/dashboard/dashboard-copy";
import { organisationHref } from "@/lib/navigation/client-routes";
import { organisationStatusView } from "@/lib/presenters/organisation-status/organisation-status-presentation";
import {
  type FirstRunAddressee,
  type FirstRunRecord,
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

/** "Contact us" about works that did not sell while the organisation's choices are paused. */
export function unsoldPausedContact(): OrganisationStateLink {
  return CONTACT("Works that did not sell");
}

const BANNER_COPY: Record<OrganisationBannerKey, BannerCopy> = {
  documents_requested: {
    title: `${organisationStatusView("docs_requested").label}.`,
    line: ({ organisationName }) =>
      `Bidding and selling for ${organisationName} open once we've checked them.`,
    act: { label: "Send documents", href: organisationHref("documents"), kind: "page" },
  },
  documents_under_review: {
    title: `${organisationStatusView("under_review").label}.`,
    line: ({ organisationName }) =>
      `We're checking ${organisationName}'s documents, usually within 2–3 working days. Bidding and selling open once we're done.`,
    act: null,
  },
  payouts_not_set_up: {
    title: `${organisationStatusView("connect_pending").label}.`,
    line: ({ organisationName }) =>
      `${organisationName}'s works can't go into a sale until a bank account is added for payouts.`,
    act: { label: "Set up payouts", href: organisationHref("payouts"), kind: "page" },
  },
  restricted: {
    title: "Bidding and selling paused.",
    line: ({ organisationName }) =>
      `${organisationName} can still see its history and pay its invoices.`,
    act: CONTACT("Organisation paused"),
  },
  not_approved: {
    title: `${organisationStatusView("rejected").label}.`,
    line: ({ organisationName }) => `We couldn't approve ${organisationName}.`,
    act: CONTACT("Organisation not approved"),
  },
  archived: {
    title: `${organisationStatusView("archived").label}.`,
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

/**
 * The banner on the page at `currentPath`. Its line stays, but an action that leads to this
 * same page is dropped: the person is already where the action is.
 */
export function organisationBannerForPage(
  banner: OrganisationBannerView,
  currentPath: string,
): OrganisationBannerView {
  const here = banner.action?.kind === "page" && banner.action.href === currentPath;
  return here ? { ...banner, action: null } : banner;
}

/** The Home first-run card's words, before anything has happened. */
export type OrganisationFirstRunCopy = { title: string; description: string };

/** What a ready organisation's first step is; `none` when the role has no step to take. */
export type FirstRunStep = "sell" | "invite" | "none";

const RECORD_WORDS: Record<FirstRunRecord, string> = {
  sales: "sales",
  payouts: "payouts",
  bids: "bids",
  purchases: "purchases",
};

/** "Sales, bids and purchases": only what this member will see, so nobody is promised a page they cannot open. */
function recordsSentence(shows: readonly FirstRunRecord[]): string {
  const words = shows.map((record) => RECORD_WORDS[record]);
  const last = words.pop() ?? "activity";
  const list = words.length > 0 ? `${words.join(", ")} and ${last}` : last;
  return list.charAt(0).toUpperCase() + list.slice(1);
}

type FirstRunWords = (
  ctx: OrganisationStateCopyContext,
  records: string,
) => OrganisationFirstRunCopy;

/**
 * A ready organisation's first steps. People who run it are asked to get it started; every
 * other member is told about their own part, never that the organisation has yet to trade.
 */
const READY_COPY: Record<FirstRunAddressee, Record<FirstRunStep, FirstRunWords>> = {
  organisation: {
    sell: ({ organisationName }, records) => ({
      title: `Get ${organisationName} started`,
      description: `Send a first work to our specialists. ${records} show here as they happen.`,
    }),
    invite: ({ organisationName }, records) => ({
      title: `Get ${organisationName} started`,
      description: `Invite your team. ${records} show here as they happen.`,
    }),
    none: ({ organisationName }, records) => ({
      title: "Nothing here yet",
      description: `${records} for ${organisationName} show here as they happen.`,
    }),
  },
  member: {
    sell: (_ctx, records) => ({
      title: "Send your first work",
      description: `Our specialists review each work you send. Your ${records.toLowerCase()} show here as they happen.`,
    }),
    invite: (_ctx, records) => ({
      title: "Nothing to show yet",
      description: `${records} show here as they happen.`,
    }),
    none: (_ctx, records) => ({
      title: "Nothing to show yet",
      description: `${records} show here as they happen.`,
    }),
  },
};

/**
 * Every first-run key. The banner above already says what the state is, so these say what this
 * page will show and when, without repeating it.
 */
const FIRST_RUN_COPY: Record<Exclude<OrganisationHomeFirstRunKey, "ready">, FirstRunWords> = {
  documents_requested: ({ organisationName }, records) => ({
    title: "Nothing here yet",
    description: `${records} for ${organisationName} show here once its documents are checked.`,
  }),
  documents_under_review: ({ organisationName }, records) => ({
    title: "Nothing here yet",
    description: `${records} for ${organisationName} show here once we've finished checking its documents.`,
  }),
  payouts_not_set_up: ({ organisationName }, records) => ({
    title: "Nothing here yet",
    description: `${records} for ${organisationName} show here as they happen.`,
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

/** What the first-run words are for: the organisation's state, the step and whom they address. */
export type FirstRunCopyInput = {
  key: OrganisationHomeFirstRunKey;
  step: FirstRunStep;
  addressee: FirstRunAddressee;
  /** The records this member's role can see; only these are named. */
  shows: readonly FirstRunRecord[];
};

/** The first-run words for one member's Home. */
export function organisationFirstRunCopy(
  { key, step, addressee, shows }: FirstRunCopyInput,
  ctx: OrganisationStateCopyContext,
): OrganisationFirstRunCopy {
  const records = recordsSentence(shows);
  return key === "ready"
    ? READY_COPY[addressee][step](ctx, records)
    : FIRST_RUN_COPY[key](ctx, records);
}

/** Why bidding for the organisation is closed, said before the person tries. */
export type OrganisationBidReasonCopy = {
  title: string;
  line: string;
  /** A way to ask LAX, when only LAX can reopen bidding. */
  contact: OrganisationStateLink | null;
};

const BID_REASON_COPY: Record<
  OrganisationBidReasonKey,
  (ctx: OrganisationStateCopyContext) => OrganisationBidReasonCopy
> = {
  documents_requested: ({ organisationName }) => ({
    title: `Bidding for ${organisationName} isn't open yet`,
    line: `It opens once ${organisationName} has sent its documents and we've checked them.`,
    contact: null,
  }),
  documents_under_review: ({ organisationName }) => ({
    title: `Bidding for ${organisationName} isn't open yet`,
    line: `Bidding for ${organisationName} opens once we've checked its documents.`,
    contact: null,
  }),
  restricted: ({ organisationName }) => ({
    title: `Bidding for ${organisationName} is paused`,
    line: "We can tell you why and when it resumes.",
    contact: CONTACT("Organisation paused"),
  }),
  not_approved: ({ organisationName }) => ({
    title: `You can't bid for ${organisationName}`,
    line: `We couldn't approve ${organisationName} to bid.`,
    contact: CONTACT("Organisation not approved"),
  }),
  archived: ({ organisationName }) => ({
    title: `You can't bid for ${organisationName}`,
    line: `${organisationName} is closed.`,
    contact: null,
  }),
};

export function organisationBidReasonCopy(
  key: OrganisationBidReasonKey,
  ctx: OrganisationStateCopyContext,
): OrganisationBidReasonCopy {
  return BID_REASON_COPY[key](ctx);
}
