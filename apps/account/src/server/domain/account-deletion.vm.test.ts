import type { AccountDeletionStatus } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { buildDeletionPageVm } from "./account-deletion.vm";

const BID_BLOCKER = {
  code: "account_deletion_pending_payments",
  message: "You have a payment still to make. Pay it before deleting your account.",
  href: "https://bid.example/purchases#payment-history",
};
const SHOP_BLOCKER = {
  code: "shop_open_orders",
  message: "You have 1 order that hasn't been paid for or delivered yet.",
  href: "https://shop.example/account/orders",
};

const clear = (product: "bid" | "shop") => ({ product, state: "clear" as const, blockers: [] });
const status = (patch: Partial<AccountDeletionStatus>): AccountDeletionStatus => ({
  requestedAt: null,
  products: [clear("bid"), clear("shop")],
  ...patch,
});

describe("buildDeletionPageVm", () => {
  it("says nothing is known when Identity could not be asked", () => {
    expect(buildDeletionPageVm(null)).toEqual({ kind: "unavailable" });
  });

  describe("when every product is clear", () => {
    it("asks for the confirmation phrase and spells out what happens", () => {
      const vm = buildDeletionPageVm(status({}));
      expect(vm).toMatchObject({ kind: "eligible", phrase: "DELETE MY ACCOUNT" });
      if (vm.kind !== "eligible") throw new Error("expected eligible");
      expect(vm.consequences.join(" ")).toMatch(/30 days you can cancel/);
      expect(vm.consequences.join(" ")).toMatch(/permanently erase/);
      expect(vm.consequences.join(" ")).toMatch(/name, email address, phone number/);
      expect(vm.consequences.join(" ")).toMatch(/password, any linked Google or Apple sign-in/);
      expect(vm.consequences.join(" ")).toMatch(
        /orders, invoices and payments without your personal details/,
      );
    });

    it("keeps the copy in British English and sentence case", () => {
      const vm = buildDeletionPageVm(status({}));
      if (vm.kind !== "eligible") throw new Error("expected eligible");
      for (const line of vm.consequences) {
        expect(line).toMatch(/^[A-Z]/);
        expect(line).toMatch(/\.$/);
        expect(line).not.toMatch(/\b(color|favorite|canceled)\b/i);
      }
    });
  });

  describe("when something is in the way", () => {
    it("groups the blockers by product, with their links", () => {
      const vm = buildDeletionPageVm(
        status({
          products: [
            { product: "bid", state: "blocked", blockers: [BID_BLOCKER] },
            { product: "shop", state: "blocked", blockers: [SHOP_BLOCKER] },
          ],
        }),
      );
      expect(vm).toEqual({
        kind: "blocked",
        groups: [
          { product: "bid", label: "LAX Bid", blockers: [BID_BLOCKER] },
          { product: "shop", label: "LAX Shop and lax.art", blockers: [SHOP_BLOCKER] },
        ],
        unreachable: [],
      });
    });

    it("leaves out products with nothing in the way", () => {
      const vm = buildDeletionPageVm(
        status({
          products: [{ product: "bid", state: "blocked", blockers: [BID_BLOCKER] }, clear("shop")],
        }),
      );
      expect(vm.kind === "blocked" && vm.groups.map((group) => group.product)).toEqual(["bid"]);
    });

    it("also names a product that could not be asked", () => {
      const vm = buildDeletionPageVm(
        status({
          products: [
            { product: "bid", state: "blocked", blockers: [BID_BLOCKER] },
            { product: "shop", state: "unavailable", blockers: [] },
          ],
        }),
      );
      expect(vm).toMatchObject({ kind: "blocked", unreachable: ["LAX Shop and lax.art"] });
    });
  });

  it("asks the person to try again when a product could not be asked and nothing else is in the way", () => {
    const vm = buildDeletionPageVm(
      status({ products: [clear("bid"), { product: "shop", state: "unavailable", blockers: [] }] }),
    );
    expect(vm).toEqual({ kind: "check_failed", unreachable: ["LAX Shop and lax.art"] });
  });

  it("never offers deletion when any product is silent", () => {
    for (const down of ["bid", "shop"] as const) {
      const vm = buildDeletionPageVm(
        status({
          products: (["bid", "shop"] as const).map((product) =>
            product === down
              ? { product, state: "unavailable" as const, blockers: [] }
              : clear(product),
          ),
        }),
      );
      expect(vm.kind).not.toBe("eligible");
    }
  });

  describe("when deletion has already been requested", () => {
    it("gives the date it was asked for and the date it will happen, thirty days on", () => {
      expect(buildDeletionPageVm(status({ requestedAt: "2026-10-23T12:00:00.000Z" }))).toEqual({
        kind: "requested",
        requestedOn: "Fri 23 Oct 2026",
        deleteOn: "Sun 22 Nov 2026",
      });
    });

    it("shows the date in UTC, so it cannot differ by where the server runs", () => {
      expect(
        buildDeletionPageVm(status({ requestedAt: "2026-12-31T23:30:00.000Z" })),
      ).toMatchObject({
        requestedOn: "Thu 31 Dec 2026",
        deleteOn: "Sat 30 Jan 2027",
      });
    });

    it("takes priority over blockers, since the only action left is to cancel", () => {
      const vm = buildDeletionPageVm(
        status({
          requestedAt: "2026-10-23T12:00:00.000Z",
          products: [{ product: "bid", state: "blocked", blockers: [BID_BLOCKER] }, clear("shop")],
        }),
      );
      expect(vm.kind).toBe("requested");
    });
  });

  describe("when the purge is holding the deletion", () => {
    const held = status({
      requestedAt: "2026-10-23T12:00:00.000Z",
      hold: { heldAt: "2026-11-23T03:00:00.000Z", reasons: [BID_BLOCKER, SHOP_BLOCKER] },
    });

    it("explains why, lists what is open, and says it is checked daily", () => {
      expect(buildDeletionPageVm(held)).toEqual({
        kind: "held",
        requestedOn: "Fri 23 Oct 2026",
        title: "Your account deletion is on hold",
        basis: expect.stringContaining("contract"),
        reasonsIntro: "What is still open:",
        reasons: [BID_BLOCKER, SHOP_BLOCKER],
        recheck: expect.stringContaining("every day"),
        resolution: expect.stringContaining("cancel the deletion"),
      });
    });
  });
});
