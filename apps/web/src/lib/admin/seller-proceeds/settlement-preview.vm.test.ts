import { describe, expect, it } from "vitest";
import { FIXTURE_PREVIEW_SALES, fixtureSettlementPreview } from "./seller-proceeds.fixture";
import { buildSettlementPreview, sumReady } from "./settlement-preview.vm";

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
    });
    expect(model.disabledReason).toBeNull();
  });

  it("totals are the lines added up, to the penny", () => {
    const totals = sumReady(FIXTURE_PREVIEW_SALES);
    expect(totals.netPence).toBe(3_520_000 + 2_140_000 + 1_562_850);
    expect(totals.hammerPence - totals.commissionPence - totals.commissionVatPence).toBe(
      totals.netPence,
    );
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
