import {
  type Product,
  type SwitchConfig,
  booksTargetMode,
  parkReasonFor,
  whenReferenceHeld,
} from "@auction/accounting-domain";
import type {
  IAccountingDocumentRegistry,
  IAccountingSourceSettingReader,
  IBidAccountingFactsReader,
  IShopAccountingFactsReader,
} from "@auction/persistence/interfaces";
import {
  ACCOUNTING_EVENT_ROUTES,
  type AccountingEvent,
  type AccountingEventRoute,
} from "./accounting-event-routes.js";

export type ProjectionOutcome =
  | { readonly outcome: "skipped"; readonly reason: string }
  | {
      readonly outcome: "projected";
      /** New documents queued for the books. */
      readonly created: number;
      /** Documents already queued with exactly these details (a replay). */
      readonly replayed: number;
      /** Contacts already queued with other details; the queued one stands. */
      readonly kept: number;
      /** New documents stored parked (in "Needs a person"), never sent until that is settled. */
      readonly parked: number;
    };

/**
 * An event the books cannot take as it stands: a policy refused it, or a reference is already
 * held by a different document. Not retried: the same facts would be refused again. It goes to
 * the failed deliveries for a person.
 */
export class AccountingProjectionRefusedError extends Error {
  readonly retryable = false;
  constructor(
    readonly code: string,
    detail: string,
  ) {
    super(`accounting_projection_refused:${code}:${detail}`);
    this.name = "AccountingProjectionRefusedError";
  }
}

/** The switch could not be read; try the event again later. */
export class AccountingSwitchUnreadableError extends Error {
  readonly retryable = true;
  constructor(code: string) {
    super(`accounting_switch_unreadable:${code}`);
    this.name = "AccountingSwitchUnreadableError";
  }
}

export type ProjectorActivity = "active" | "inactive" | "unreadable";

export interface AccountingProjectionDeps {
  readonly facts: IBidAccountingFactsReader;
  /** The Shop's order facts; absent where the Shop flow is not wired (it then skips, never guesses). */
  readonly shopFacts?: IShopAccountingFactsReader;
  readonly settings: IAccountingSourceSettingReader;
  readonly registry: IAccountingDocumentRegistry;
  readonly routes?: Readonly<Record<string, AccountingEventRoute>>;
}

/** No Shop facts reader: every Shop event is skipped, so nothing is booked from a guess. */
const NO_SHOP_FACTS: IShopAccountingFactsReader = {
  orderPaid: async () => ({ status: "skip", reason: "shop_facts_not_wired" }),
};

/** Does the switch aim this product's new documents at Books (in any mode)? Same rule as the sender. */
function aimsAtBooks(config: SwitchConfig, product: Product): boolean {
  return booksTargetMode(config[product]) !== null;
}

/**
 * Turns one business event into accounting documents and queues them: reads the facts the event
 * names, runs the flow's pure policy, and registers each document in order (contact, invoice, then
 * what refers to them). A document the policy parks is stored parked, never queued. Idempotent by
 * LAX reference, so a redelivered event changes nothing.
 * Products whose switch does not aim at Books are skipped: with the switch on Xero, nothing new
 * is written.
 */
export class AccountingProjection {
  private readonly routes: Readonly<Record<string, AccountingEventRoute>>;

  constructor(private readonly deps: AccountingProjectionDeps) {
    this.routes = deps.routes ?? ACCOUNTING_EVENT_ROUTES;
  }

  /** The event types this projection reads. */
  eventTypes(): readonly string[] {
    return Object.keys(this.routes);
  }

  /**
   * Is any product aimed at Books? `inactive` lets the projector move its cursor past the events
   * of the moment (they belong to whatever else books them); `unreadable` says nothing either way,
   * so the projector leaves everything as it is and tries again next tick.
   */
  async activity(): Promise<ProjectorActivity> {
    const config = await this.deps.settings.read();
    if (!config.ok) return "unreadable";
    return Object.values(this.routes).some((r) => aimsAtBooks(config.value, r.product))
      ? "active"
      : "inactive";
  }

  /** Is any product aimed at Books? If not, the projector projects nothing this tick. */
  async isActive(): Promise<boolean> {
    return (await this.activity()) === "active";
  }

  async project(event: AccountingEvent): Promise<ProjectionOutcome> {
    const route = Object.hasOwn(this.routes, event.eventType)
      ? this.routes[event.eventType]
      : undefined;
    if (!route) return { outcome: "skipped", reason: "not_an_accounting_event" };
    const config = await this.deps.settings.read();
    if (!config.ok) throw new AccountingSwitchUnreadableError(config.refusal.code);
    if (!aimsAtBooks(config.value, route.product)) {
      return { outcome: "skipped", reason: "books_not_selected" };
    }
    const routed = await route.project(
      { bid: this.deps.facts, shop: this.deps.shopFacts ?? NO_SHOP_FACTS },
      event,
    );
    if (routed.status === "skip") return { outcome: "skipped", reason: routed.reason };
    if (!routed.projection.ok) {
      const { code, message } = routed.projection.refusal;
      throw new AccountingProjectionRefusedError(code, message);
    }
    let created = 0;
    let replayed = 0;
    let kept = 0;
    let parked = 0;
    const projection = routed.projection.value;
    for (const document of projection.documents) {
      const park = parkReasonFor(projection, document.reference);
      const registered = await this.deps.registry.register({
        document,
        sourceEventRef: `domain_event:${event.id}`,
        ...(park ? { park } : {}),
      });
      if (registered.ok) {
        if (registered.value.created) created += 1;
        else replayed += 1;
        if (registered.value.created && park) parked += 1;
        continue;
      }
      const held =
        registered.refusal.code === "reference_in_use" &&
        whenReferenceHeld(document.kind) === "keep_held";
      if (!held) {
        throw new AccountingProjectionRefusedError(
          registered.refusal.code,
          `${document.reference}: ${registered.refusal.message}`,
        );
      }
      kept += 1;
    }
    return { outcome: "projected", created, replayed, kept, parked };
  }
}
