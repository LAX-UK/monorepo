import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/finance/admin-finance-mutations", () => ({
  runPayoutSettlementAction: vi.fn(),
}));
vi.mock("@/lib/admin/pickers/staff-entity-search", () => ({
  searchLegalEntityOptions: vi.fn(async () => []),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { PayoutSettlementWorkspace } = await import("./payout-settlement-workspace");
const { FIXTURE_PREVIEW_DEALS, FIXTURE_PREVIEW_SALES, fixtureSettlementPreview } = await import(
  "@/lib/admin/seller-proceeds/seller-proceeds.fixture"
);

const entity = { id: "00000000-0000-4000-8000-0000000000d1", label: "Northbank Gallery Ltd" };
const REASON = "Seller asked to be paid early";

async function confirmRun() {
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: REASON } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: /^Pay / }));
  });
  return dialog;
}

describe("PayoutSettlementWorkspace confirm", () => {
  it("sends the confirmed net and the payment and deal ids with the run", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const preview = fixtureSettlementPreview(undefined, {}, FIXTURE_PREVIEW_DEALS);
    render(
      <PayoutSettlementWorkspace
        loadPreview={vi.fn().mockResolvedValue(preview)}
        runSettlement={run}
        initial={{ entity, preview, confirming: true }}
      />,
    );
    await confirmRun();
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    const form = run.mock.calls[0]?.[0] as FormData;
    expect(form.get("reason")).toBe(REASON);
    expect(JSON.parse(String(form.get("confirmed")))).toEqual({
      netPence: 8_791_850,
      paymentIds: FIXTURE_PREVIEW_SALES.flatMap((s) => (s.kind === "ready" ? [s.paymentId] : [])),
      dealIds: [FIXTURE_PREVIEW_DEALS[0]?.dealId],
    });
  });

  it("on 'figures changed' says so in the dialog, reloads the preview and confirms the new amount with a new key", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ error: "figures_changed" })
      .mockResolvedValue(undefined);
    const before = fixtureSettlementPreview();
    const after = fixtureSettlementPreview(undefined, {}, FIXTURE_PREVIEW_DEALS);
    const loadPreview = vi.fn().mockResolvedValue(after);
    render(
      <PayoutSettlementWorkspace
        loadPreview={loadPreview}
        runSettlement={run}
        initial={{ entity, preview: before, confirming: true }}
      />,
    );
    const dialog = await confirmRun();
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent("Figures changed — review again"),
    );
    expect(loadPreview).toHaveBeenCalledWith(entity.id);
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: "Pay £87,918.50 to Northbank Gallery Ltd now?" }),
      ).toBeInTheDocument(),
    );
    const firstKey = (run.mock.calls[0]?.[0] as FormData).get("idempotencyKey");
    await confirmRun();
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    const second = run.mock.calls[1]?.[0] as FormData;
    expect(second.get("idempotencyKey")).not.toBe(firstKey);
    expect(JSON.parse(String(second.get("confirmed"))).netPence).toBe(8_791_850);
  });
});
