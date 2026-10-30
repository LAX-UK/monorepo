import {
  type DeliveryQuoteAction,
  type DeliveryQuoteActor,
  type DeliveryQuoteStatus,
  deliveryQuoteTransition,
} from "@auction/domain";
import type {
  DeliveryQuoteRow,
  IAccountPurchaseFactsReader,
  IDeliveryQuoteRepository,
} from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import type {
  BuyingResult,
  IDeliveryQuoteService,
  IStaffDeliveryQuoteService,
  PurchaseQuoteView,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { buyingError, memberIsPayer, quoteView } from "./purchase-view.js";

/** Every quote is priced in pounds sterling, like the invoice it joins. */
const QUOTE_CURRENCY = "GBP";

/** Tells the buyer a quote is ready to accept. Best effort: a failed notice never undoes the quote. */
export interface IDeliveryQuoteReadyNotifier {
  quoteReady(quote: DeliveryQuoteRow): Promise<void>;
}

/** The won lot a quote is for: its buying account, from the lot itself. */
export interface IQuoteLotLookup {
  buyerAccountOf(lotId: string): Promise<string | null>;
}

type Move = { action: DeliveryQuoteAction; actor: DeliveryQuoteActor };

/** Applies one move from the domain table to the stored quote, or says why it cannot. */
async function applyMove(
  quotes: IDeliveryQuoteRepository,
  current: DeliveryQuoteRow | null,
  move: Move,
  write: { actorUserId: string; amount?: string; quoteNote?: string | null },
): Promise<
  | { ok: true; quote: DeliveryQuoteRow }
  | { ok: false; code: "quote_step_not_allowed" | "quote_wrong_actor" | "quote_changed" }
> {
  const from: DeliveryQuoteStatus | null = current?.status ?? null;
  const decision = deliveryQuoteTransition(from, move.action, move.actor);
  if (!decision.allowed) return { ok: false, code: decision.reason };
  if (!current) return { ok: false, code: "quote_step_not_allowed" };
  const moved = await quotes.transition(current.id, current.status, {
    status: decision.next,
    ...write,
  });
  return moved ? { ok: true, quote: moved } : { ok: false, code: "quote_changed" };
}

/**
 * The buyer's side of a courier quote. Only the account's payers ask for, accept or withdraw a
 * quote, and only on a lot the account won; the state machine lives in the domain.
 */
export class DeliveryQuoteService implements IDeliveryQuoteService {
  constructor(
    private readonly deps: {
      quotes: IDeliveryQuoteRepository;
      purchases: IAccountPurchaseFactsReader;
    },
  ) {}

  /** Refuses non-payers and lots the account did not win. */
  private async guard(actor: OrganisationMemberActor, lotId: string) {
    if (!memberIsPayer(actor)) return buyingError("insufficient_entity_role");
    const [row] = await this.deps.purchases.list({
      legalEntityId: actor.legalEntityId,
      memberUserId: null,
      lotIds: [lotId],
      limit: 1,
      offset: 0,
    });
    return row ? null : buyingError("purchase_not_found");
  }

  async request(
    actor: OrganisationMemberActor,
    lotId: string,
    destination: string,
  ): BuyingResult<PurchaseQuoteView> {
    const refused = await this.guard(actor, lotId);
    if (refused) return err(refused);
    const current = await this.deps.quotes.findLatest(lotId, actor.legalEntityId);
    const decision = deliveryQuoteTransition(current?.status ?? null, "request", "buyer");
    if (!decision.allowed) return err(buyingError(decision.reason));
    const created = await this.deps.quotes.insertRequested({
      lotId,
      buyerLegalEntityId: actor.legalEntityId,
      destination,
      currency: QUOTE_CURRENCY,
      requestedByUserId: actor.userId,
    });
    return created ? ok(quoteView(created, actor)) : err(buyingError("quote_changed"));
  }

  accept(actor: OrganisationMemberActor, lotId: string): BuyingResult<PurchaseQuoteView> {
    return this.move(actor, lotId, "accept");
  }

  withdraw(actor: OrganisationMemberActor, lotId: string): BuyingResult<PurchaseQuoteView> {
    return this.move(actor, lotId, "withdraw");
  }

  private async move(
    actor: OrganisationMemberActor,
    lotId: string,
    action: "accept" | "withdraw",
  ): BuyingResult<PurchaseQuoteView> {
    const refused = await this.guard(actor, lotId);
    if (refused) return err(refused);
    const current = await this.deps.quotes.findLatest(lotId, actor.legalEntityId);
    const result = await applyMove(
      this.deps.quotes,
      current,
      { action, actor: "buyer" },
      {
        actorUserId: actor.userId,
      },
    );
    return result.ok ? ok(quoteView(result.quote, actor)) : err(buyingError(result.code));
  }
}

/** The saleroom team prices a requested quote for the account that won the lot. */
export class StaffDeliveryQuoteService implements IStaffDeliveryQuoteService {
  constructor(
    private readonly deps: {
      quotes: IDeliveryQuoteRepository;
      lots: IQuoteLotLookup;
      notifier: IDeliveryQuoteReadyNotifier;
    },
  ) {}

  async quote(input: {
    staffUserId: string;
    lotId: string;
    amount: string;
    note: string | null;
  }): BuyingResult<DeliveryQuoteRow> {
    const account = await this.deps.lots.buyerAccountOf(input.lotId);
    if (!account) return err(buyingError("purchase_not_found"));
    const current = await this.deps.quotes.findLatest(input.lotId, account);
    const result = await applyMove(
      this.deps.quotes,
      current,
      { action: "quote", actor: "staff" },
      { actorUserId: input.staffUserId, amount: input.amount, quoteNote: input.note },
    );
    if (!result.ok) return err(buyingError(result.code));
    await this.deps.notifier.quoteReady(result.quote);
    return ok(result.quote);
  }
}
