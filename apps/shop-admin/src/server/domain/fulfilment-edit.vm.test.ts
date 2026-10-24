import {
  FULFILMENT_CARRIER_MAX_LENGTH,
  FULFILMENT_TRACKING_NUMBER_MAX_LENGTH,
} from "@auction/shop-contracts";
import { SHOP_FULFILMENT_STATUSES, type ShopFulfilmentStatus } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import {
  type FulfilmentEditInput,
  checkFulfilmentEdit,
  fulfilmentEditPermission,
  fulfilmentMoveKind,
  movesNeedTracking,
} from "./fulfilment-edit.vm";
import { fulfilmentNextOptions } from "./order-detail.vm";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const PAID = "2026-10-01T09:00:00.000Z";

function input(overrides: Partial<FulfilmentEditInput>): FulfilmentEditInput {
  return {
    status: null,
    carrier: "",
    tracking: "",
    possessionAt: null,
    possessionRecorded: false,
    paidAt: PAID,
    now: NOW,
    ...overrides,
  };
}

describe("the statuses offered next", () => {
  it("offers only the moves the fulfilment can make from where it is", () => {
    expect(fulfilmentNextOptions("awaiting_dispatch").map((option) => option.value)).toEqual([
      "in_transit",
      "ready_for_collection",
      "in_storage",
      "cancelled",
    ]);
    expect(fulfilmentNextOptions("in_transit").map((option) => option.value)).toEqual([
      "delivered",
      "cancelled",
    ]);
  });

  it("offers nothing from an end state, and never the status it is already in", () => {
    for (const status of ["collected", "delivered", "cancelled"] as const) {
      expect(fulfilmentNextOptions(status)).toEqual([]);
    }
    for (const status of SHOP_FULFILMENT_STATUSES) {
      expect(fulfilmentNextOptions(status).map((option) => option.value)).not.toContain(status);
    }
  });

  it("offers nothing for a status it does not know", () => {
    expect(fulfilmentNextOptions("teleported")).toEqual([]);
  });

  it("labels every option in words", () => {
    for (const status of SHOP_FULFILMENT_STATUSES) {
      for (const option of fulfilmentNextOptions(status)) {
        expect(option.label).not.toContain("_");
      }
    }
  });
});

describe("how a move is sent", () => {
  it.each(["delivered", "collected", "in_storage"] as const)(
    "records possession when moving to %s for the first time",
    (status) => {
      expect(fulfilmentMoveKind(status, { possessionRecorded: false })).toBe("possession");
      expect(fulfilmentMoveKind(status, { possessionRecorded: true })).toBe("update");
    },
  );

  it.each(["in_production", "awaiting_dispatch", "in_transit", "cancelled"] as const)(
    "sends %s as an ordinary update",
    (status: ShopFulfilmentStatus) => {
      expect(fulfilmentMoveKind(status, { possessionRecorded: false })).toBe("update");
    },
  );

  it("asks for tracking only when the work goes in the post", () => {
    expect(movesNeedTracking("in_transit")).toBe(true);
    expect(movesNeedTracking("ready_for_collection")).toBe(false);
  });
});

describe("who can edit", () => {
  it("hides Edit from roles that cannot change fulfilment", () => {
    expect(fulfilmentEditPermission({ canEdit: false, nextStatusCount: 3 })).toEqual({
      kind: "hidden",
    });
  });

  it("explains an end state instead of offering Edit", () => {
    expect(fulfilmentEditPermission({ canEdit: true, nextStatusCount: 0 })).toEqual({
      kind: "final",
    });
  });

  it("offers Edit when there is somewhere to move to", () => {
    expect(fulfilmentEditPermission({ canEdit: true, nextStatusCount: 2 })).toEqual({
      kind: "editable",
    });
  });
});

describe("checkFulfilmentEdit", () => {
  it("asks for a status first", () => {
    expect(checkFulfilmentEdit(input({}))).toEqual({
      ok: false,
      errors: { status: "Choose the next status." },
    });
  });

  it("sends a plain move with no dispatch details", () => {
    expect(checkFulfilmentEdit(input({ status: "ready_for_collection" }))).toEqual({
      ok: true,
      request: { kind: "update", status: "ready_for_collection" },
    });
  });

  it("sends carrier and tracking, trimmed, when dispatching", () => {
    expect(
      checkFulfilmentEdit(
        input({ status: "in_transit", carrier: " Royal Mail ", tracking: " AB 123-456 " }),
      ),
    ).toEqual({
      ok: true,
      request: {
        kind: "update",
        status: "in_transit",
        carrier: "Royal Mail",
        trackingNumber: "AB 123-456",
      },
    });
  });

  it("lets a dispatch go with no tracking yet", () => {
    expect(checkFulfilmentEdit(input({ status: "in_transit" }))).toEqual({
      ok: true,
      request: { kind: "update", status: "in_transit" },
    });
  });

  it("ignores tracking typed for a status that does not use it", () => {
    const result = checkFulfilmentEdit(
      input({ status: "ready_for_collection", carrier: "DHL", tracking: "!!!" }),
    );
    expect(result).toEqual({
      ok: true,
      request: { kind: "update", status: "ready_for_collection" },
    });
  });

  it("rejects tracking characters the API does not accept", () => {
    const result = checkFulfilmentEdit(
      input({ status: "in_transit", carrier: "DHL", tracking: "AB#123" }),
    );
    expect(result).toEqual({
      ok: false,
      errors: { tracking: "Use letters, numbers, spaces and hyphens only." },
    });
  });

  it("asks for the carrier when a tracking number is given without one", () => {
    expect(checkFulfilmentEdit(input({ status: "in_transit", tracking: "AB123" }))).toEqual({
      ok: false,
      errors: { carrier: "Add the carrier this tracking number belongs to." },
    });
  });

  it("enforces the length limits", () => {
    const result = checkFulfilmentEdit(
      input({
        status: "in_transit",
        carrier: "c".repeat(FULFILMENT_CARRIER_MAX_LENGTH + 1),
        tracking: "t".repeat(FULFILMENT_TRACKING_NUMBER_MAX_LENGTH + 1),
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        carrier: `Use ${FULFILMENT_CARRIER_MAX_LENGTH} characters or fewer.`,
        tracking: `Use ${FULFILMENT_TRACKING_NUMBER_MAX_LENGTH} characters or fewer.`,
      },
    });
  });

  describe("recording possession", () => {
    it("needs the moment the customer took possession", () => {
      expect(checkFulfilmentEdit(input({ status: "delivered" }))).toEqual({
        ok: false,
        errors: { possessionAt: "Enter the date and time the customer took possession." },
      });
    });

    it("sends the moment with the status", () => {
      expect(
        checkFulfilmentEdit(
          input({ status: "collected", possessionAt: "2026-10-20T10:00:00.000Z" }),
        ),
      ).toEqual({
        ok: true,
        request: {
          kind: "possession",
          status: "collected",
          possessionAt: "2026-10-20T10:00:00.000Z",
        },
      });
    });

    it("refuses a moment in the future", () => {
      expect(
        checkFulfilmentEdit(
          input({ status: "delivered", possessionAt: "2026-10-25T10:00:00.000Z" }),
        ),
      ).toEqual({ ok: false, errors: { possessionAt: "Possession cannot be in the future." } });
    });

    it("refuses a moment before the order was paid", () => {
      expect(
        checkFulfilmentEdit(
          input({ status: "delivered", possessionAt: "2026-09-30T10:00:00.000Z" }),
        ),
      ).toEqual({
        ok: false,
        errors: { possessionAt: "Possession cannot be before the order was paid." },
      });
    });

    it("sends a later move to the same status as an ordinary update", () => {
      expect(checkFulfilmentEdit(input({ status: "delivered", possessionRecorded: true }))).toEqual(
        { ok: true, request: { kind: "update", status: "delivered" } },
      );
    });
  });
});
