import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  BUYING_ACCOUNT,
  InMemoryDeliveryQuotes,
  InMemoryPurchaseFacts,
  InMemoryRegistrations,
  LOTS,
  NOW,
} from "../../testing/in-memory-workspace-buying.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { AccountPurchasesService } from "./account-purchases.service.js";
import { AccountRegistrationsService } from "./account-registrations.service.js";
import { CollectionBookingService } from "./collection-booking.service.js";
import { DeliveryQuoteService, StaffDeliveryQuoteService } from "./delivery-quote.service.js";

const actor = (role: LegalEntityMemberRole, over: Partial<OrganisationMemberActor> = {}) => ({
  userId: `${role}-1`,
  legalEntityId: BUYING_ACCOUNT,
  role,
  ...over,
});

const purchasesService = (reader = new InMemoryPurchaseFacts()) =>
  new AccountPurchasesService({ reader, now: () => NOW });

describe("AccountPurchasesService.list", () => {
  it("gives owners and finance every purchase, with invoice states worked out", async () => {
    for (const role of ["owner", "admin", "finance"] as const) {
      const page = (
        await purchasesService().list(actor(role), { limit: 50, offset: 0 })
      )._unsafeUnwrap();
      expect(page.items).toHaveLength(4);
      const byLot = new Map(page.items.map((i) => [i.lotId, i]));
      expect(byLot.get(LOTS.paid)?.invoice.status).toBe("paid");
      expect(byLot.get(LOTS.paid)?.delivery.stage).toBe("choose");
      expect(byLot.get(LOTS.due)?.invoice.status).toBe("due");
      expect(byLot.get(LOTS.overdue)?.invoice).toMatchObject({
        status: "overdue",
        dueAt: new Date("2026-11-17T12:00:00Z"),
      });
      expect(byLot.get(LOTS.agentWin)?.wonBy?.name).toBe("Tom Whitfield");
      expect(byLot.get(LOTS.due)?.paymentRole).toBe("payer");
    }
  });

  it("gives a buyer agent their own wins only, told rather than paying", async () => {
    const page = (
      await purchasesService().list(actor("buyer_agent"), { limit: 50, offset: 0 })
    )._unsafeUnwrap();
    expect(page.items.map((i) => i.lotId)).toEqual([LOTS.agentWin]);
    expect(page.items[0]?.paymentRole).toBe("informed");
  });

  it("refuses roles that do not follow purchases", async () => {
    for (const role of ["consignor", "viewer"] as const) {
      const result = await purchasesService().list(actor(role), { limit: 50, offset: 0 });
      expect(result._unsafeUnwrapErr()).toMatchObject({
        code: "insufficient_entity_role",
        status: 403,
      });
    }
  });

  it("pages, saying where the next page starts", async () => {
    const first = (
      await purchasesService().list(actor("owner"), { limit: 3, offset: 0 })
    )._unsafeUnwrap();
    expect(first.nextOffset).toBe(3);
    const last = (
      await purchasesService().list(actor("owner"), { limit: 3, offset: 3 })
    )._unsafeUnwrap();
    expect(last.nextOffset).toBeNull();
  });
});

describe("AccountPurchasesService.exportCsv", () => {
  it("writes plain words, never stored codes, for the member's purchases", async () => {
    const csv = (await purchasesService().exportCsv(actor("finance")))._unsafeUnwrap();
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "Lot,Title,Sale,Won by,Won on,Hammer price,Invoice total,Invoice status,Due on,Delivery",
    );
    expect(lines).toHaveLength(5);
    expect(csv).toContain("Overdue");
    expect(csv).not.toContain("not_invoiced");
  });

  it("refuses a viewer", async () => {
    expect((await purchasesService().exportCsv(actor("viewer"))).isErr()).toBe(true);
  });
});

describe("AccountRegistrationsService", () => {
  const service = new AccountRegistrationsService(new InMemoryRegistrations());

  it("shows owners and admins every registration with who registered", async () => {
    const rows = (await service.list(actor("admin")))._unsafeUnwrap();
    expect(rows.map((r) => r.registeredBy.name)).toEqual(["Maya Okafor", "Tom Whitfield"]);
  });

  it("shows a buyer agent their own and refuses finance", async () => {
    expect((await service.list(actor("buyer_agent")))._unsafeUnwrap().map((r) => r.id)).toEqual([
      "reg-2",
    ]);
    expect((await service.list(actor("finance")))._unsafeUnwrapErr().status).toBe(403);
  });
});

describe("delivery quotes", () => {
  const build = () => {
    const quotes = new InMemoryDeliveryQuotes();
    const purchases = new InMemoryPurchaseFacts(undefined, quotes);
    const notifier = { quoteReady: vi.fn(async () => {}) };
    return {
      quotes,
      notifier,
      buyer: new DeliveryQuoteService({ quotes, purchases }),
      staff: new StaffDeliveryQuoteService({
        quotes,
        lots: { buyerAccountOf: async () => BUYING_ACCOUNT },
        notifier,
      }),
    };
  };

  it("runs request, price and accept, telling the buyer when it is priced", async () => {
    const { buyer, staff, notifier } = build();
    const requested = (
      await buyer.request(actor("finance"), LOTS.paid, "12 Gallery Row, London")
    )._unsafeUnwrap();
    expect(requested).toMatchObject({ status: "requested", actions: ["withdraw"] });

    const quoted = (
      await staff.quote({ staffUserId: "staff-1", lotId: LOTS.paid, amount: "240.00", note: null })
    )._unsafeUnwrap();
    expect(quoted.status).toBe("quoted");
    expect(notifier.quoteReady).toHaveBeenCalledWith(expect.objectContaining({ amount: "240.00" }));

    const accepted = (await buyer.accept(actor("owner"), LOTS.paid))._unsafeUnwrap();
    expect(accepted).toMatchObject({ status: "accepted", actions: [] });
  });

  it("refuses a second request while one is open, and accepting before it is priced", async () => {
    const { buyer } = build();
    await buyer.request(actor("finance"), LOTS.paid, "12 Gallery Row, London");
    expect(
      (await buyer.request(actor("finance"), LOTS.paid, "elsewhere"))._unsafeUnwrapErr().code,
    ).toBe("quote_step_not_allowed");
    expect((await buyer.accept(actor("finance"), LOTS.paid))._unsafeUnwrapErr().code).toBe(
      "quote_step_not_allowed",
    );
  });

  it("lets the buyer ask again after withdrawing", async () => {
    const { buyer } = build();
    await buyer.request(actor("finance"), LOTS.paid, "12 Gallery Row, London");
    expect((await buyer.withdraw(actor("finance"), LOTS.paid))._unsafeUnwrap().status).toBe(
      "withdrawn",
    );
    expect(
      (await buyer.request(actor("finance"), LOTS.paid, "34 Gallery Row, London"))._unsafeUnwrap()
        .status,
    ).toBe("requested");
  });

  it("refuses members who do not pay, and lots the account did not win", async () => {
    const { buyer } = build();
    for (const role of ["buyer_agent", "consignor", "viewer"] as const) {
      expect(
        (await buyer.request(actor(role), LOTS.paid, "12 Gallery Row"))._unsafeUnwrapErr().code,
      ).toBe("insufficient_entity_role");
    }
    expect(
      (
        await buyer.request(actor("owner", { isImpersonation: true }), LOTS.paid, "12 Gallery Row")
      )._unsafeUnwrapErr().code,
    ).toBe("insufficient_entity_role");
    expect(
      (await buyer.request(actor("owner"), LOTS.otherAccount, "12 Gallery Row"))._unsafeUnwrapErr()
        .status,
    ).toBe(404);
  });

  it("does not let staff price a quote nobody asked for", async () => {
    const { staff, notifier } = build();
    const result = await staff.quote({
      staffUserId: "staff-1",
      lotId: LOTS.paid,
      amount: "240.00",
      note: null,
    });
    expect(result._unsafeUnwrapErr().code).toBe("quote_step_not_allowed");
    expect(notifier.quoteReady).not.toHaveBeenCalled();
  });
});

describe("CollectionBookingService", () => {
  const service = new CollectionBookingService({
    settings: {
      selfServeEnabled: false,
      slotCapacityPerHour: null,
      hours: "Monday to Friday, 10:00 to 17:00",
      bookingEmail: "info@lax.bid",
    },
    purchases: new InMemoryPurchaseFacts(),
    places: { placeForLot: async () => "LAX Saleroom, London" },
  });

  it("offers email booking with the place and hours while self-serve is off", async () => {
    expect((await service.offer(actor("finance"), LOTS.paid))._unsafeUnwrap()).toEqual({
      kind: "email",
      email: "info@lax.bid",
      hours: "Monday to Friday, 10:00 to 17:00",
      place: "LAX Saleroom, London",
    });
  });

  it("answers only for purchases the member can see", async () => {
    expect((await service.offer(actor("buyer_agent"), LOTS.paid))._unsafeUnwrapErr().status).toBe(
      404,
    );
    expect((await service.offer(actor("viewer"), LOTS.paid))._unsafeUnwrapErr().status).toBe(403);
  });
});
