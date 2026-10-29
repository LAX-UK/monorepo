import { type EntityActor, entityActorCan } from "./entity-capabilities.js";

/**
 * Whose buying records a member of an organisation reads:
 * - `all`: everything bid or won for the organisation;
 * - `own`: only what they bid or won for it themselves;
 * - `null`: none (the page is not theirs).
 */
export type BuyingRecordScope = "all" | "own" | null;

/** Reading capabilities count for an impersonating admin too: these are read-only views. */
const reads = (actor: EntityActor, name: Parameters<typeof entityActorCan>[1]) =>
  entityActorCan({ role: actor.role }, name);

/**
 * Bids: members who bid without an authorisation (owners, admins) follow every bid placed for
 * the organisation; buyer agents follow their own.
 */
export function accountBidScope(actor: EntityActor): BuyingRecordScope {
  if (reads(actor, "entity.bid.place_without_authorisation")) return "all";
  if (reads(actor, "entity.bid.place")) return "own";
  return null;
}

/**
 * Purchases: members who see the organisation's money (owners, admins, finance) follow every
 * lot won for it; buyer agents follow the lots they won themselves.
 */
export function accountPurchaseScope(actor: EntityActor): BuyingRecordScope {
  if (reads(actor, "entity.finance.read")) return "all";
  if (reads(actor, "entity.bid.place")) return "own";
  return null;
}
