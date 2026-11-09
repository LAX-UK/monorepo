import { describe, expect, it, vi } from "vitest";
import type {
  DeliveryQuoteForUpdate,
  DeliveryQuoteStaffRow,
  DeliveryQuoteStaffTx,
  DeliveryQuoteStaffUnitOfWork,
} from "./delivery-quote-staff.ports.js";
import { createDeliveryQuoteStaffService } from "./delivery-quote-staff.service.js";

const NOW = new Date("2026-11-11T12:00:00Z");

const row = (overrides: Partial<DeliveryQuoteStaffRow> = {}): DeliveryQuoteStaffRow => ({
  id: "00000000-0000-4000-8000-0000000000a1",
  orderId: "00000000-0000-4000-8000-0000000000b1",
  orderReference: "LAX-S-10482",
  status: "requested",
  country: "DE",
  regionId: "eu",
  recipientName: "Anna Weber",
  address: ["Friedrichstrasse 12", "Berlin 10117", "Germany"],
  phone: "+49 30 1234567",
  items: ["Warm Basket"],
  merchandisePence: 42000,
  requestedAt: new Date("2026-11-10T09:00:00Z"),
  holdUntil: new Date("2026-11-13T09:00:00Z"),
  quote: null,
  endReason: null,
  declineNote: null,
  ...overrides,
});

function build(locked: Partial<DeliveryQuoteForUpdate> | null = {}) {
  const store = {
    lock: vi.fn(async () =>
      locked === null
        ? null
        : ({
            row: row(),
            orderStatus: "pending_payment",
            identitySubjectId: "subject-1",
            guestEmail: null,
            ...locked,
          } satisfies DeliveryQuoteForUpdate),
    ),
    saveQuote: vi.fn(async () => undefined),
    decline: vi.fn(async () => undefined),
  };
  const mail = {
    quoteReady: vi.fn(async () => undefined),
    quoteDeclined: vi.fn(async () => undefined),
  };
  const audit = { append: vi.fn(async () => undefined) };
  const replays = new Map<string, unknown>();
  const commands = {
    begin: vi.fn(async (input: { idempotencyKey: string }) =>
      replays.has(input.idempotencyKey)
        ? { kind: "replay" as const, result: replays.get(input.idempotencyKey) }
        : { kind: "started" as const },
    ),
    complete: vi.fn(async (input: { idempotencyKey: string; result: unknown }) => {
      replays.set(input.idempotencyKey, input.result);
    }),
  };
  const tx = { store, mail, audit, commands } as unknown as DeliveryQuoteStaffTx;
  const uow: DeliveryQuoteStaffUnitOfWork = { run: (fn) => fn(tx) };
  const release = vi.fn(async () => undefined);
  const service = createDeliveryQuoteStaffService({
    uow,
    reader: { list: async () => [row()], waitingCount: async () => 1 },
    orders: { release },
    clock: { now: () => NOW },
  });
  return { service, store, mail, audit, release };
}

const send = {
  quoteId: "00000000-0000-4000-8000-0000000000a1",
  pricePence: 8500,
  carrier: "  DHL Express ",
  service: "Express insured",
  leadTimeNote: "",
  actorSubjectId: "staff-1",
  idempotencyKey: "key-0000000001",
};

describe("sending a delivery quote", () => {
  it("prices the request, holds the print three working days more, audits it and emails the buyer", async () => {
    const { service, store, mail, audit } = build();
    await service.sendQuote(send);
    expect(store.saveQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        pricePence: 8500,
        carrier: "DHL Express",
        service: "Express insured",
        leadTimeNote: null,
        // Wednesday 11 November at noon: Thursday, Friday, Monday.
        holdUntil: new Date("2026-11-16T12:00:00Z"),
        actorSubjectId: "staff-1",
      }),
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "order.write",
        action: "delivery_quote.send",
        beforeJson: { status: "requested", pricePence: null },
        afterJson: expect.objectContaining({ status: "quoted", pricePence: 8500 }),
      }),
    );
    expect(mail.quoteReady).toHaveBeenCalledWith(
      expect.objectContaining({ pricePence: 8500, carrier: "DHL Express" }),
    );
  });

  it("lets staff revise a quote that has been sent, until it is accepted", async () => {
    const { service, store } = build({
      row: row({
        status: "quoted",
        quote: {
          pricePence: 9000,
          carrier: "UPS",
          service: null,
          leadTimeNote: null,
          quotedAt: NOW,
        },
      }),
    });
    await service.sendQuote(send);
    expect(store.saveQuote).toHaveBeenCalledOnce();
  });

  it("will not touch an accepted quote", async () => {
    const { service, store, mail } = build({ row: row({ status: "accepted" }) });
    await expect(service.sendQuote(send)).rejects.toMatchObject({ statusCode: 409 });
    expect(store.saveQuote).not.toHaveBeenCalled();
    expect(mail.quoteReady).not.toHaveBeenCalled();
  });

  it("will not quote an order that is no longer waiting", async () => {
    const { service, store } = build({ orderStatus: "expired" });
    await expect(service.sendQuote(send)).rejects.toMatchObject({ statusCode: 409 });
    expect(store.saveQuote).not.toHaveBeenCalled();
  });

  it("names each field that needs another look, saving and sending nothing", async () => {
    const { service, store, mail } = build();
    await expect(service.sendQuote({ ...send, pricePence: 0, carrier: " " })).rejects.toMatchObject(
      {
        name: "DeliveryQuoteStaffRejectedError",
        issues: [
          { field: "pricePence", reason: "below_one_penny" },
          { field: "carrier", reason: "required" },
        ],
      },
    );
    expect(store.saveQuote).not.toHaveBeenCalled();
    expect(mail.quoteReady).not.toHaveBeenCalled();
  });

  it("answers an unknown quote as not found", async () => {
    const { service } = build(null);
    await expect(service.sendQuote(send)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("replays a repeated key without a second email", async () => {
    const { service, mail } = build();
    await service.sendQuote(send);
    await service.sendQuote(send);
    expect(mail.quoteReady).toHaveBeenCalledOnce();
  });
});

describe("turning a request down", () => {
  const decline = {
    quoteId: send.quoteId,
    note: " Our couriers cannot collect framed work there. ",
    actorSubjectId: "staff-1",
    idempotencyKey: "key-0000000002",
  };

  it("ends the quote as cannot deliver, tells the buyer why, and releases the order", async () => {
    const { service, store, mail, audit, release } = build();
    await service.decline(decline);
    expect(store.decline).toHaveBeenCalledWith(
      expect.objectContaining({ note: "Our couriers cannot collect framed work there." }),
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "delivery_quote.decline",
        afterJson: expect.objectContaining({ status: "withdrawn", endReason: "cannot_deliver" }),
      }),
    );
    expect(mail.quoteDeclined).toHaveBeenCalledWith(
      expect.objectContaining({ note: "Our couriers cannot collect framed work there." }),
    );
    expect(release).toHaveBeenCalledWith(row().orderId, send.quoteId);
  });

  it("needs a reason, and does nothing without one", async () => {
    const { service, store, release } = build();
    await expect(service.decline({ ...decline, note: "  " })).rejects.toMatchObject({
      issues: [{ field: "note", reason: "required" }],
    });
    expect(store.decline).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("will not turn down an accepted quote", async () => {
    const { service, release } = build({ row: row({ status: "accepted" }) });
    await expect(service.decline(decline)).rejects.toMatchObject({ statusCode: 409 });
    expect(release).not.toHaveBeenCalled();
  });
});
