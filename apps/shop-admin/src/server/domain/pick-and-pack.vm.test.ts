import type { AdminPickAndPack, AdminPickLine } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  confirmNotice,
  packProgress,
  packRowViews,
  presentCertificateStatus,
  scanSource,
  swapReasonError,
  swapResultMessage,
} from "./pick-and-pack.vm";

const line = (overrides: Partial<AdminPickLine> = {}): AdminPickLine => ({
  orderLineId: "11111111-1111-4111-8111-111111111111",
  artworkId: "22222222-2222-4222-8222-222222222222",
  artworkTitle: "Harbour at dusk",
  label: "7/24",
  numbered: true,
  storageLocation: "Plan chest B, drawer 3",
  printedToOrder: false,
  confirmedAt: null,
  confirmedBy: null,
  replacedLabel: null,
  certificate: { status: "none", certificateId: null, note: null, issuedAt: null },
  cancelled: false,
  ...overrides,
});

const pack = (...lines: AdminPickLine[]): AdminPickAndPack => ({ orderId: "o", lines });

describe("packRowViews", () => {
  it("says where a print is, or that it is printed to order", () => {
    const [stored, toOrder, unknown] = packRowViews(
      pack(
        line(),
        line({ orderLineId: "b", storageLocation: null, printedToOrder: true }),
        line({ orderLineId: "c", storageLocation: null, printedToOrder: false }),
      ),
    );
    expect(stored?.where).toBe("Plan chest B, drawer 3");
    expect(toOrder?.where).toBe("Print to order");
    expect(unknown?.where).toBe("Location not recorded");
  });

  it("leaves out cancelled lines and lets only unconfirmed prints be confirmed or replaced", () => {
    const rows = packRowViews(
      pack(
        line({ orderLineId: "open" }),
        line({ orderLineId: "done", confirmedAt: "2026-11-04T10:15:00.000Z", confirmedBy: "Pat" }),
        line({ orderLineId: "gone", cancelled: true }),
      ),
    );
    expect(rows.map((row) => row.orderLineId)).toEqual(["open", "done"]);
    expect(rows[0]).toMatchObject({ canConfirm: true, canSwap: true, confirmed: false });
    expect(rows[1]).toMatchObject({ canConfirm: false, canSwap: false, confirmed: true });
    expect(rows[1]?.confirmedNote).toMatch(/^Confirmed by Pat on /);
  });

  it("holds back confirming while a certificate is blocked", () => {
    const [row] = packRowViews(
      pack(
        line({
          certificate: {
            status: "blocked",
            certificateId: null,
            note: "Record the artist's written authority",
            issuedAt: null,
          },
        }),
      ),
    );
    expect(row?.canConfirm).toBe(false);
    expect(row?.canSwap).toBe(true);
  });

  it("notes the print a line was moved from", () => {
    const [row] = packRowViews(pack(line({ label: "9/24", replacedLabel: "7/24" })));
    expect(row?.replacedNote).toBe("Sent in place of 7/24");
  });
});

describe("packProgress", () => {
  it("counts confirmed prints", () => {
    const rows = packRowViews(
      pack(
        line({ orderLineId: "a", confirmedAt: "2026-11-04T10:15:00.000Z" }),
        line({ orderLineId: "b" }),
      ),
    );
    expect(packProgress(rows)).toBe("1 of 2 prints confirmed");
    expect(packProgress(rows.slice(0, 1))).toBe("1 of 1 print confirmed");
  });
});

describe("scanSource", () => {
  it.each([
    ["NG0001", "label_code"],
    ["k7m2qx", "label_code"],
    ["7/24", "typed_label"],
    ["AP 2/3", "typed_label"],
    ["OE-0021", "typed_label"],
    ["7", "typed_label"],
  ] as const)("reads %s as %s", (value, source) => {
    expect(scanSource(value)).toBe(source);
  });
});

describe("confirmNotice", () => {
  it("names the print in hand and the one ordered", () => {
    expect(
      confirmNotice(
        { outcome: "wrong_print", reason: "Not free to send", scannedLabel: "9/24" },
        "7/24",
        false,
      ),
    ).toMatchObject({ kind: "wrong_print", title: "This is 9/24. The order is for 7/24" });
    expect(
      confirmNotice(
        { outcome: "wrong_print", reason: "Unknown", scannedLabel: null },
        "7/24",
        false,
      ),
    ).toMatchObject({ title: "That is not 7/24" });
  });

  it("offers a same-owner swap to anyone, and a different owner's only to shop admins", () => {
    const same = confirmNotice(
      {
        outcome: "swap_available",
        needsAdmin: false,
        to: { editionId: "e9", label: "9/24" },
        reason: "",
      },
      "7/24",
      false,
    );
    expect(same).toMatchObject({ kind: "swap", blockedReason: null });
    const other = {
      outcome: "swap_available",
      needsAdmin: true,
      to: { editionId: "e21", label: "21/24" },
      reason: "",
    } as const;
    expect(confirmNotice(other, "7/24", false)).toMatchObject({
      blockedReason: "Only a shop admin can send a print another party owns.",
    });
    expect(confirmNotice(other, "7/24", true)).toMatchObject({ blockedReason: null });
  });
});

describe("swap wording", () => {
  it("requires a reason within the limit", () => {
    expect(swapReasonError("  ")).toBe("Say why this print is being replaced.");
    expect(swapReasonError("x".repeat(301))).toMatch(/300/);
    expect(swapReasonError("Corner creased")).toBeNull();
  });

  it("says whether the buyer was emailed", () => {
    expect(swapResultMessage({ label: "9/24", previousLabel: "7/24", buyerNotified: true })).toBe(
      "Sending 9/24 instead of 7/24. The buyer has been emailed.",
    );
    expect(swapResultMessage({ label: "9/24", previousLabel: "7/24", buyerNotified: false })).toBe(
      "Sending 9/24 instead of 7/24.",
    );
  });
});

describe("certificate statuses", () => {
  it("map every status to a label and a tone", () => {
    for (const status of ["none", "pending_confirmation", "issued", "to_send", "blocked"]) {
      expect(presentCertificateStatus(status).label).toMatch(/\w/);
    }
    expect(presentCertificateStatus("blocked").tone).toBe("danger");
    expect(presentCertificateStatus("issued").tone).toBe("success");
  });
});
