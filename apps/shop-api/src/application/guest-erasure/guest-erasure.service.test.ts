import { describe, expect, it, vi } from "vitest";
import type { GuestErasureSnapshot, GuestErasureStore } from "../ports/guest-erasure.store.js";
import { GuestErasureService } from "./guest-erasure.service.js";

const GUEST_ID = "2f0b6d7e-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-30T12:00:00Z");

function storeWith(guest: GuestErasureSnapshot | null) {
  const erase = vi.fn(async () => ({ orders: 2, enquiries: 1, links: 3 }));
  const store: GuestErasureStore = {
    read: async () => guest,
    withLockedGuest: async (_id, work) => (guest ? work(guest, erase) : null),
  };
  return { store, erase };
}

const guest = (overrides: Partial<GuestErasureSnapshot> = {}): GuestErasureSnapshot => ({
  guestCustomerId: GUEST_ID,
  email: "ada@example.com",
  erasedAt: null,
  claimedAt: null,
  orders: [
    {
      reference: "LAX-S-10001",
      status: "paid",
      fulfilmentStatus: "delivered",
      openRefund: false,
      openCase: false,
      cancellationEndsAt: null,
    },
  ],
  ...overrides,
});

const request = {
  guestCustomerId: GUEST_ID,
  confirmation: "Ada@Example.com",
  reason: "Asked by email on 29 October to delete their data.",
  actorSubjectId: "staff-1",
};

describe("GuestErasureService", () => {
  it("erases a guest whose orders are finished, with the typed email and a reason", async () => {
    const { store, erase } = storeWith(guest());
    const service = new GuestErasureService(store, () => NOW);
    await expect(service.erase(request)).resolves.toEqual({
      kind: "erased",
      erasedAt: NOW,
      orders: 2,
      enquiries: 1,
      links: 3,
    });
    expect(erase).toHaveBeenCalledWith({
      actorSubjectId: "staff-1",
      reason: "Asked by email on 29 October to delete their data.",
      now: NOW,
    });
  });

  it("refuses when the typed email does not match, and erases nothing", async () => {
    const { store, erase } = storeWith(guest());
    const service = new GuestErasureService(store, () => NOW);
    await expect(service.erase({ ...request, confirmation: "ada@example.co" })).resolves.toEqual({
      kind: "confirmation_mismatch",
    });
    expect(erase).not.toHaveBeenCalled();
  });

  it("needs a reason the audit log can use", async () => {
    const { store, erase } = storeWith(guest());
    const service = new GuestErasureService(store, () => NOW);
    await expect(service.erase({ ...request, reason: "  asked " })).resolves.toEqual({
      kind: "reason_invalid",
    });
    expect(erase).not.toHaveBeenCalled();
  });

  it("explains an order still in progress", async () => {
    const { store, erase } = storeWith(
      guest({
        orders: [
          {
            reference: "LAX-S-10002",
            status: "paid",
            fulfilmentStatus: "in_transit",
            openRefund: false,
            openCase: false,
            cancellationEndsAt: null,
          },
        ],
      }),
    );
    const service = new GuestErasureService(store, () => NOW);
    await expect(service.erase(request)).resolves.toEqual({
      kind: "blocked",
      reason: "open_order",
      message: "Available once LAX-S-10002 is delivered, collected or cancelled.",
    });
    expect(erase).not.toHaveBeenCalled();
  });

  it("answers not found for an unknown guest", async () => {
    const { store } = storeWith(null);
    await expect(new GuestErasureService(store).erase(request)).resolves.toEqual({
      kind: "not_found",
    });
  });

  it("describes the state staff see before erasing", async () => {
    const claimed = new Date("2026-10-01T09:00:00Z");
    const { store } = storeWith(guest({ claimedAt: claimed }));
    await expect(new GuestErasureService(store).state(GUEST_ID)).resolves.toEqual({
      guestCustomerId: GUEST_ID,
      erasedAt: null,
      allowed: false,
      blockedReason: "claimed",
      blockedMessage:
        "This guest now has a LAX account. Their data is erased by closing that account.",
      blockingOrderReferences: [],
      availableFrom: null,
    });
  });
});
