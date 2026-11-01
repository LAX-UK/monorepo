import { CLIENT_ROUTES, organisationHref } from "@/lib/navigation/client-routes";
import { formatDate } from "@/lib/ui/format";
import type {
  ConsignmentChecklistDeadline,
  ConsignmentChecklistItem,
  ConsignmentChecklistItemId,
  ConsignmentChecklistItemState,
  ConsignmentChecklistWaitingOn,
} from "@auction/domain";

/** Whose consignment this is, for the words and the places to act. */
export type ChecklistCopyContext = {
  accountKind: "personal" | "organisation";
  /** The organisation's name; ignored for a personal account. */
  organisationName: string | null;
  /** Where the agreement is read and accepted (an anchor on the consignment page). */
  agreementHref: string;
  /** Why the account's state holds accepting the agreement, as a line; `null` while it allows it. */
  agreementHeld?: string | null;
};

/** How one checklist row reads and where its button goes. */
export type ChecklistItemView = {
  id: ConsignmentChecklistItemId;
  state: ConsignmentChecklistItemState;
  title: string;
  /** Why it is needed, in one sentence. */
  why: string;
  /** By when, or "Done". */
  due: string;
  /** The button when the person can act now. */
  action: { label: string; href: string } | null;
  /** What it is waiting on when someone else has to act. */
  waiting: string | null;
};

type Ctx = ChecklistCopyContext;

function orgName(ctx: Ctx): string {
  return ctx.organisationName ?? "the organisation";
}

const TITLES: Record<ConsignmentChecklistItemId, (ctx: Ctx) => string> = {
  identity: (ctx) =>
    ctx.accountKind === "organisation" ? `Verify ${orgName(ctx)}` : "Verify your identity",
  agreement: () => "Accept the consignment agreement",
  payouts: () => "Set up payouts",
};

const WHY: Record<
  ConsignmentChecklistItemId,
  (ctx: Ctx, state: ConsignmentChecklistItemState) => string
> = {
  identity: (ctx) =>
    ctx.accountKind === "organisation"
      ? "We check the organisation's documents before a specialist accepts the work."
      : "We confirm who is selling before a specialist accepts the work. It takes about 3 minutes.",
  agreement: (_ctx, state) => {
    if (state === "not_yet") {
      return "Your specialist will send the estimate and terms. You accept them here.";
    }
    if (state === "waiting") return "Your specialist proposed an estimate and terms for this work.";
    return "Read the specialist's estimate and the seller conditions, then accept them.";
  },
  payouts: (ctx) =>
    ctx.accountKind === "organisation"
      ? "So we can pay the organisation when the work sells. Bank details stay with Stripe."
      : "So we can pay you when the work sells. Your bank details stay with Stripe.",
};

function dueText(deadline: ConsignmentChecklistDeadline): string {
  switch (deadline.kind) {
    case "before_specialist_accepts":
      return "Needed before the specialist accepts the work";
    case "before_cataloguing":
      return "Needed before the work is catalogued";
    case "before_sale_live":
      return deadline.date
        ? `Needed before the sale goes live on ${formatDate(deadline.date)}`
        : "Needed before the sale goes live";
  }
}

const WAITING: Record<ConsignmentChecklistWaitingOn, (ctx: Ctx) => string> = {
  lax_identity_check: (ctx) =>
    ctx.accountKind === "organisation"
      ? `We're checking ${orgName(ctx)}'s documents`
      : "We're checking your documents",
  organisation_acceptor: (ctx) => `An owner or admin of ${orgName(ctx)} accepts this`,
  organisation_payouts: (ctx) => `Waiting for ${orgName(ctx)}'s payout setup`,
};

const ACTIONS: Record<ConsignmentChecklistItemId, (ctx: Ctx) => { label: string; href: string }> = {
  identity: (ctx) =>
    ctx.accountKind === "organisation"
      ? { label: "Open documents", href: organisationHref("documents") }
      : { label: "Verify", href: CLIENT_ROUTES.verifyIdentity },
  agreement: (ctx) => ({ label: "Review", href: ctx.agreementHref }),
  payouts: (ctx) =>
    ctx.accountKind === "organisation"
      ? { label: "Set up", href: organisationHref("payouts") }
      : { label: "Set up", href: CLIENT_ROUTES.payoutSetup },
};

/** The words and links for one checklist item. Every item and state is covered by a table. */
export function checklistItemView(item: ConsignmentChecklistItem, ctx: Ctx): ChecklistItemView {
  // A held action is not offered; the row says why instead of showing a button that would refuse.
  const held =
    item.id === "agreement" && item.state === "action" ? (ctx.agreementHeld ?? null) : null;
  return {
    id: item.id,
    state: item.state,
    title: TITLES[item.id](ctx),
    why: WHY[item.id](ctx, item.state),
    due: item.state === "done" ? "Done" : dueText(item.deadline),
    action: item.state === "action" && !held ? ACTIONS[item.id](ctx) : null,
    waiting: held ?? (item.waitingOn ? WAITING[item.waitingOn](ctx) : null),
  };
}
