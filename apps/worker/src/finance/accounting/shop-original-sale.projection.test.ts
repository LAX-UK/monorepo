import type { ShopOriginalSalePaidFacts } from "@auction/accounting-domain";
import type { FactsRead, IBidAccountingFactsReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { classifyDeliveryError } from "../../lib/delivery-retry.js";
import { InMemoryAccountingStore } from "../../testing/in-memory-accounting-store.js";
import { AccountingEventPayloadError } from "./accounting-event-routes.js";
import { AccountingProjection } from "./accounting-projection.service.js";

const SALE_ID = "7c1e5b6a-1111-4a5b-8c9d-000000000001";
const PARTY_ID = "7c1e5b6a-2222-4a5b-8c9d-000000000002";

const facts: ShopOriginalSalePaidFacts = {
  originalSaleId: SALE_ID,
  invoiceNumber: "LAX-INV-000125",
  buyer: { partyId: PARTY_ID, name: "Ada Collector", email: "ada@example.test" },
  paidOn: "2031-03-01",
  label: "Original artwork: Harbour at dusk",
  salePricePence: 1_250_000,
  vatTreatment: null,
  vatPence: null,
};

const event = (payload: Record<string, unknown> = {}) => ({
  id: 41,
  eventType: "shop.accounting.original_sale_paid",
  aggregateId: SALE_ID,
  payload: {
    schemaVersion: 1,
    originalSaleId: SALE_ID,
    paidAt: "2031-03-01T10:00:00.000Z",
    ...payload,
  },
});

function setUp(read: FactsRead<ShopOriginalSalePaidFacts> = { status: "ready", facts }) {
  const store = new InMemoryAccountingStore();
  store.setBooks("dry_run");
  const originalSalePaid = vi.fn(async () => read);
  const projection = new AccountingProjection({
    facts: {} as IBidAccountingFactsReader,
    shopFacts: { orderPaid: vi.fn(), originalSalePaid },
    settings: store,
    registry: store,
  });
  return { store, projection, originalSalePaid };
}

describe("Shop original sold, projected (flow 22)", () => {
  it("queues the contact, the numbered invoice and the payment, in the Shop's company", async () => {
    const { store, projection, originalSalePaid } = setUp();
    expect(await projection.project(event())).toMatchObject({
      outcome: "projected",
      created: 3,
      parked: 0,
    });
    expect(originalSalePaid).toHaveBeenCalledWith(SALE_ID);
    expect(store.documents().map((d) => [d.kind, d.reference, d.legalEntity])).toEqual([
      ["contact", `LAX-SHOP-CON-${PARTY_ID}`, "london_art_exchange"],
      ["invoice", `LAX-SHOP-INV-original-${SALE_ID}`, "london_art_exchange"],
      ["payment", `LAX-SHOP-PAY-original-${SALE_ID}`, "london_art_exchange"],
    ]);
    // Replayed by LAX reference: never a second invoice.
    expect(await projection.project(event())).toMatchObject({ created: 0, replayed: 3 });
  });

  it("books nothing for a sale Stripe invoiced, or one not paid", async () => {
    const { store, projection } = setUp({
      status: "skip",
      reason: "original_sale_invoiced_by_stripe",
    });
    expect(await projection.project(event())).toEqual({
      outcome: "skipped",
      reason: "original_sale_invoiced_by_stripe",
    });
    expect(store.documents()).toEqual([]);
  });

  it("with the Shop switch away from Books it reads nothing", async () => {
    const { store, projection, originalSalePaid } = setUp();
    store.setBooks("off");
    expect(await projection.project(event())).toMatchObject({ outcome: "skipped" });
    expect(originalSalePaid).not.toHaveBeenCalled();
    expect(store.documents()).toEqual([]);
  });

  it("refuses a payload outside its contract, without retrying", async () => {
    const { projection } = setUp();
    const error = await projection
      .project(event({ originalSaleId: "not-a-sale" }))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountingEventPayloadError);
    expect(classifyDeliveryError(error)).toBe("fatal");
  });
});
