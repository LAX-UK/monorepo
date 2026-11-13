import { describe, expect, it } from "vitest";
import {
  FIXTURE_PREVIEW_DEALS,
  FIXTURE_PREVIEW_SALES,
  fixtureSettlementPreview,
} from "./seller-proceeds.fixture";
import { buildSettlementPreview } from "./settlement-preview.vm";

const statusLabel = (status: string) => (status === "scheduled" ? "Scheduled" : status);

function sales(model: ReturnType<typeof buildSettlementPreview>) {
  if (model.kind !== "sales") throw new Error(`expected sales, got ${model.kind}`);
  return model;
}

describe("buildSettlementPreview", () => {
  it("lists every sale, keeps the held one in place, and totals the ready rows exactly", () => {
    const model = sales(
      buildSettlementPreview(fixtureSettlementPreview(), "Northbank Gallery Ltd", statusLabel),
    );
    expect(model.rows.map((row) => row.lot)).toEqual(["Lot 7", "Lot 12", "Lot 18", "Lot 21"]);
    expect(model.rows[0]).toMatchObject({
      hammer: "£40,000.00",
      commissionRate: "10%",
      commission: "−£4,000.00",
      vatRate: "20%",
      vat: "−£800.00",
      net: "£35,200.00",
      rateSource: { kind: "agreement", reference: "C-1031" },
      held: null,
    });
    expect(model.rows[2]?.rateSource).toMatchObject({ kind: "recorded_by_staff" });
    expect(model.rows[3]).toMatchObject({
      hammer: "£6,200.00",
      net: null,
      held: { reason: "No signed agreement", canRecord: true },
    });
    expect(model.summary).toEqual({
      readyLabel: "Sales ready 3 of 4",
      heldLabel: "1 held",
      hammer: "£82,759.66",
      commission: "£8,775.97",
      vat: "£1,755.19",
      deals: null,
      net: "£72,228.50",
    });
  });

  it("says the premium is LAX's and when the held lot will be paid", () => {
    const model = sales(
      buildSettlementPreview(fixtureSettlementPreview(), "Northbank Gallery Ltd", statusLabel),
    );
    expect(model.premiumLine).toBe(
      "Buyer's premium on these sales is kept by LAX and isn't part of this payout. Lot 21 stays held and joins a later payout once its agreement is recorded.",
    );
  });

  it("asks before paying, naming the seller, the amount and what stays held", () => {
    const model = sales(
      buildSettlementPreview(fixtureSettlementPreview(), "Northbank Gallery Ltd", statusLabel),
    );
    expect(model.run).toEqual({
      label: "Run settlement for £72,228.50",
      amount: "£72,228.50",
      confirmTitle: "Pay £72,228.50 to Northbank Gallery Ltd now?",
      confirmBody:
        "A payout is created at once from the 3 ready sales above and sent to the seller's payout account. Lot 21 stays held. It cannot be undone from here.",
      confirmed: {
        netPence: 7_222_850,
        paymentIds: FIXTURE_PREVIEW_SALES.flatMap((sale) =>
          sale.kind === "ready" ? [sale.paymentId] : [],
        ),
        dealIds: [],
      },
    });
    expect(model.disabledReason).toBeNull();
  });

  it("shows the API's totals and confirms the API's net, never a sum of its own", () => {
    const preview = fixtureSettlementPreview();
    // Totals that are not the rows added up: the screen must still show these.
    preview.pending.totals = {
      hammerPence: 100,
      commissionPence: 20,
      commissionVatPence: 4,
      refundChargePence: 0,
      dealsNetPence: 0,
      netPence: 76,
    };
    const model = sales(buildSettlementPreview(preview, "Northbank Gallery Ltd", statusLabel));
    expect(model.summary).toMatchObject({
      hammer: "£1.00",
      commission: "£0.20",
      vat: "£0.04",
      net: "£0.76",
    });
    expect(model.run?.amount).toBe("£0.76");
    expect(model.run?.confirmed.netPence).toBe(76);
  });

  it("lists released private sales, pays them and counts them in the confirmed amount", () => {
    const model = sales(
      buildSettlementPreview(
        fixtureSettlementPreview(undefined, {}, FIXTURE_PREVIEW_DEALS),
        "Northbank Gallery Ltd",
        statusLabel,
      ),
    );
    expect(model.dealRows).toEqual([
      {
        id: FIXTURE_PREVIEW_DEALS[0]?.dealId,
        reference: "PS-2026-0042",
        price: "£18,000.00",
        commission: "−£2,160.00",
        costs: "−£150.00",
        net: "£15,690.00",
      },
    ]);
    expect(model.summary.deals).toBe("£15,690.00");
    expect(model.summary.net).toBe("£87,918.50");
    expect(model.run).toMatchObject({
      confirmTitle: "Pay £87,918.50 to Northbank Gallery Ltd now?",
      confirmBody:
        "A payout is created at once from the 3 ready sales and 1 private sale above and sent to the seller's payout account. Lot 21 stays held. It cannot be undone from here.",
      confirmed: { netPence: 8_791_850, dealIds: [FIXTURE_PREVIEW_DEALS[0]?.dealId] },
    });
  });

  it("a seller with only released private sales can be paid, not 'nothing to settle'", () => {
    const model = sales(
      buildSettlementPreview(
        fixtureSettlementPreview([], {}, FIXTURE_PREVIEW_DEALS),
        "Northbank Gallery Ltd",
        statusLabel,
      ),
    );
    expect(model.run).toMatchObject({
      amount: "£15,690.00",
      confirmed: { netPence: 1_569_000, paymentIds: [] },
    });
    expect(model.disabledReason).toBeNull();
  });

  it("turns the run off when every sale is held", () => {
    const held = FIXTURE_PREVIEW_SALES.filter((sale) => sale.kind === "held");
    const model = sales(
      buildSettlementPreview(fixtureSettlementPreview(held), "Northbank Gallery Ltd", statusLabel),
    );
    expect(model.run).toBeNull();
    expect(model.disabledReason).toBe("Every sale is held");
    expect(model.summary.readyLabel).toBe("Sales ready 0 of 1");
  });

  it("has nothing to settle when no sale is waiting", () => {
    expect(
      buildSettlementPreview(fixtureSettlementPreview([]), "Northbank Gallery Ltd", statusLabel),
    ).toEqual({ kind: "nothing_to_settle" });
  });

  it("stops at an open payout", () => {
    const preview = fixtureSettlementPreview(undefined, {
      openPayout: { status: "scheduled" } as never,
    });
    expect(buildSettlementPreview(preview, "Northbank Gallery Ltd", statusLabel)).toEqual({
      kind: "open_payout",
      statusLabel: "Scheduled",
    });
  });

  it("holds everything while the VAT setting is missing", () => {
    const missing = FIXTURE_PREVIEW_SALES.map((sale) => ({
      kind: "held" as const,
      paymentId: sale.paymentId,
      lotId: sale.lotId,
      lotNumber: sale.lotNumber,
      lotTitle: sale.lotTitle,
      agreement: null,
      reason: "vat_setting_missing" as const,
      hammerPence: sale.hammerPence,
    }));
    const model = buildSettlementPreview(
      fixtureSettlementPreview(missing),
      "Northbank Gallery Ltd",
      statusLabel,
    );
    expect(model.kind).toBe("vat_missing");
  });

  it("names several held lots together", () => {
    const twoHeld = [
      ...FIXTURE_PREVIEW_SALES,
      {
        ...FIXTURE_PREVIEW_SALES[3],
        paymentId: "pay-e",
        lotNumber: 22,
      } as (typeof FIXTURE_PREVIEW_SALES)[number],
    ];
    const model = sales(
      buildSettlementPreview(
        fixtureSettlementPreview(twoHeld),
        "Northbank Gallery Ltd",
        statusLabel,
      ),
    );
    expect(model.premiumLine).toContain(
      "Lot 21 and Lot 22 stay held and join a later payout once their agreements are recorded.",
    );
  });
});
