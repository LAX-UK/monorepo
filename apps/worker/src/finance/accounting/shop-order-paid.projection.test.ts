import type { ShopOrderPaidFacts } from "@auction/accounting-domain";
import type { FactsRead, IBidAccountingFactsReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { classifyDeliveryError } from "../../lib/delivery-retry.js";
import { InMemoryAccountingStore } from "../../testing/in-memory-accounting-store.js";
import { AccountingInvoiceLinesChangedError } from "./accounting-event-routes.js";
import {
  AccountingProjection,
  AccountingProjectionRefusedError,
} from "./accounting-projection.service.js";

const ORDER_ID = "5b6a7c1e-1111-4a5b-8c9d-000000000001";
const PARTY_ID = "5b6a7c1e-2222-4a5b-8c9d-000000000002";
const PRINT = "5b6a7c1e-3333-4a5b-8c9d-000000000003";
const FRAME = "5b6a7c1e-4444-4a5b-8c9d-000000000004";

const facts = (over: Partial<ShopOrderPaidFacts> = {}): ShopOrderPaidFacts => ({
  orderId: ORDER_ID,
  invoiceNumber: "LAX-INV-000124",
  buyer: { partyId: PARTY_ID, name: "Ada Collector", email: "ada@example.test" },
  paidOn: "2031-03-01",
  totalPence: 59_500,
  lines: [
    {
      id: PRINT,
      kind: "goods",
      label: "Harbour at dusk · 7/24",
      grossPence: 45_000,
      vatTreatment: null,
      vatPence: null,
    },
    {
      id: FRAME,
      kind: "framing",
      label: "Framing: Natural oak",
      grossPence: 12_000,
      vatTreatment: null,
      vatPence: null,
    },
  ],
  delivery: { scope: "uk", label: "UK insured delivery", grossPence: 2_500, vatPence: null },
  ...over,
});

const event = (lineIds = [PRINT, FRAME]) => ({
  id: 40,
  eventType: "shop.accounting.order_paid",
  aggregateId: ORDER_ID,
  payload: { schemaVersion: 1, orderId: ORDER_ID, lineIds, paidAt: "2031-03-01T10:00:00.000Z" },
});

const bid = {
  invoiceRaised: vi.fn(),
  paymentCaptured: vi.fn(),
  paymentRefunded: vi.fn(),
} as unknown as IBidAccountingFactsReader;

function setUp(
  read: FactsRead<ShopOrderPaidFacts> = { status: "ready", facts: facts() },
  wired = true,
) {
  const store = new InMemoryAccountingStore();
  store.setBooks("dry_run");
  const orderPaid = vi.fn(async () => read);
  const projection = new AccountingProjection({
    facts: bid,
    ...(wired ? { shopFacts: { orderPaid } } : {}),
    settings: store,
    registry: store,
  });
  return { store, projection, orderPaid };
}

describe("Shop order paid, projected", () => {
  it("queues the contact, the numbered invoice and the payment, in the Shop's company", async () => {
    const { store, projection, orderPaid } = setUp();
    expect(await projection.project(event())).toEqual({
      outcome: "projected",
      created: 3,
      replayed: 0,
      kept: 0,
      parked: 0,
    });
    expect(orderPaid).toHaveBeenCalledWith(ORDER_ID);
    expect(
      store.documents().map((d) => [d.kind, d.reference, d.legalEntity, d.record.status]),
    ).toEqual([
      ["contact", `LAX-SHOP-CON-${PARTY_ID}`, "london_art_exchange", "pending"],
      ["invoice", `LAX-SHOP-INV-${ORDER_ID}`, "london_art_exchange", "pending"],
      ["payment", `LAX-SHOP-PAY-${ORDER_ID}`, "london_art_exchange", "pending"],
    ]);
    // Never in the Bid company.
    expect(store.documents().some((d) => d.legalEntity === "london_auction_xchange")).toBe(false);
  });

  it("is idempotent by LAX reference: the same event again is a replay", async () => {
    const { store, projection } = setUp();
    await projection.project(event());
    expect(await projection.project(event())).toMatchObject({ created: 0, replayed: 3 });
    expect(store.documents()).toHaveLength(3);
  });

  it("parks the outside-UK delivery quote in 'Needs a person' and never queues it", async () => {
    const abroad = facts({
      totalPence: 61_000,
      delivery: {
        scope: "outside_uk",
        label: "Delivery outside the UK",
        grossPence: 4_000,
        vatPence: 667,
      },
    });
    const { store, projection } = setUp({ status: "ready", facts: abroad });
    expect(await projection.project(event())).toMatchObject({ created: 4, parked: 1 });
    const parked = store
      .documents()
      .find((d) => d.reference === `LAX-SHOP-INV-${ORDER_ID}-delivery`);
    expect(parked?.record).toMatchObject({
      status: "needs_review",
      lookup: "clear",
      issued: null,
      reason: "accounting_parked_vat_on_outside_uk_delivery",
    });
    // A replay leaves it parked.
    await projection.project(event());
    expect(store.documents().find((d) => d.id === parked?.id)?.record.status).toBe("needs_review");
  });

  it("refuses lines other than the ones the event named, without retrying", async () => {
    const { projection } = setUp();
    const error = await projection.project(event([PRINT])).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountingInvoiceLinesChangedError);
    expect(classifyDeliveryError(error)).toBe("fatal");
  });

  it("refuses an order whose lines do not add up to its total, for a person", async () => {
    const { projection } = setUp({ status: "ready", facts: facts({ totalPence: 1 }) });
    const error = await projection.project(event()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountingProjectionRefusedError);
    expect((error as AccountingProjectionRefusedError).code).toBe("bad_facts");
  });

  it("skips, never guesses, when the Shop's facts are not wired", async () => {
    const { store, projection } = setUp(undefined, false);
    expect(await projection.project(event())).toEqual({
      outcome: "skipped",
      reason: "shop_facts_not_wired",
    });
    expect(store.documents()).toEqual([]);
  });

  it("with the Shop on Xero it reads nothing", async () => {
    const { store, projection, orderPaid } = setUp();
    store.setBooks("off", "live");
    expect(await projection.project(event())).toEqual({
      outcome: "skipped",
      reason: "books_not_selected",
    });
    expect(orderPaid).not.toHaveBeenCalled();
  });
});
