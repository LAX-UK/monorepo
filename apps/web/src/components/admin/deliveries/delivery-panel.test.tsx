import {
  BOOKED_UNPAID,
  DELIVERY_FIXTURE_NOW,
  ON_THE_WAY,
  deliveryFixture,
} from "@/lib/admin/deliveries/deliveries.fixture";
import type { DeliveryView } from "@/lib/data/http/admin-deliveries.schema";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeliveryPanel } from "./delivery-panel";

const now = new Date(DELIVERY_FIXTURE_NOW);

function panelFor(row: DeliveryView | null, canWork = true, onBack = vi.fn()) {
  return (
    <StaffTooltipProvider>
      <DeliveryPanel
        row={row}
        missing={row === null}
        onBack={onBack}
        canWork={canWork}
        panelProps={{ open: true, onOpenChange: vi.fn() }}
        now={now}
      />
    </StaffTooltipProvider>
  );
}

function renderPanel(row = deliveryFixture(), canWork = true) {
  render(panelFor(row, canWork));
  return within(screen.getByRole("dialog"));
}

describe("DeliveryPanel", () => {
  it("gives what staff need to price a request: where to, the size, the hammer price, paid or not", () => {
    const panel = renderPanel();
    expect(
      panel.getByRole("heading", { level: 2, name: "Lot 42 · Harbour at dusk" }),
    ).toBeVisible();
    expect(panel.getByText("Waiting for a price")).toBeVisible();
    // The buyer and their paddle on one line, as in the mockup.
    expect(panel.getByText("Example Trading Ltd · Paddle 118")).toHaveClass("whitespace-nowrap");
    expect(panel.getByText("12 Rue Exemple, 69002 Lyon, France")).toBeVisible();
    expect(panel.getByRole("button", { name: /Copy Destination/i })).toBeInTheDocument();
    expect(panel.getByText("61 × 76 cm, framed")).toBeVisible();
    expect(panel.getByText("£1,250.00")).toBeVisible();
    expect(panel.getByText("Not yet")).toBeVisible();
    expect(panel.getByText("Not priced yet.")).toBeVisible();
    expect(panel.getByText("Buyer asked for a delivery price")).toBeVisible();
    expect(panel.queryByText("Delivery", { selector: "h3" })).toBeNull();
  });

  it("shows the quote, and the delivery once booked", () => {
    const panel = renderPanel(ON_THE_WAY);
    expect(panel.getByText("£180.00")).toBeVisible();
    expect(panel.getByText("Insured, two-person delivery")).toBeVisible();
    expect(panel.getByText("Example Couriers")).toBeVisible();
    expect(panel.getByText("EX123456789GB")).toBeVisible();
    expect(panel.getByText("In transit")).toBeVisible();
    expect(panel.getByText("LAX sent a quote of £180.00")).toBeVisible();
    expect(panel.getByText("Handed to the courier")).toBeVisible();
    // Dispatch keeps no time of its own: the panel says so rather than showing a guess.
    expect(panel.getByText("LAX · Time not recorded")).toBeVisible();
  });

  it("says a booked delivery has not started on Lot fulfilment yet", () => {
    const panel = renderPanel(BOOKED_UNPAID);
    expect(panel.getByText("Awaiting payment")).toBeVisible();
    expect(panel.getByText("Not started")).toBeVisible();
  });

  it("links Fulfilment to the lot's fulfilment record as the full page", () => {
    const panel = renderPanel();
    expect(panel.getByRole("link", { name: /Open full page/ })).toHaveAttribute(
      "href",
      "/admin/lot-fulfilment?lot=10700000-0000-4000-8000-000000000042",
    );
    expect(panel.queryByText("View only")).toBeNull();
  });

  it("is View only for read-only staff, with no link they cannot open and no actions", () => {
    const panel = renderPanel(deliveryFixture(), false);
    expect(panel.getByText("View only")).toBeVisible();
    expect(panel.queryByRole("link", { name: /Open full page/ })).toBeNull();
    expect(panel.queryByRole("button", { name: /Send quote/ })).toBeNull();
  });

  it("says a lot in the address has no delivery, with a way back to the list (D6)", () => {
    const onBack = vi.fn();
    render(panelFor(null, true, onBack));
    const panel = within(screen.getByRole("dialog", { name: "Delivery not found" }));
    expect(
      panel.getByText("This delivery could not be found. It may have been withdrawn."),
    ).toBeVisible();
    fireEvent.click(panel.getByRole("button", { name: "Back to the list" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("says when the request changed while its panel was open (D6)", () => {
    const { rerender } = render(panelFor(deliveryFixture()));
    const changed = "The buyer changed this request while you had it open.";
    expect(screen.queryByText(changed)).toBeNull();

    // The list refreshed: the buyer withdrew the request meanwhile.
    rerender(
      panelFor(
        deliveryFixture({
          status: "closed",
          closedReason: "withdrawn",
          quote: { ...deliveryFixture().quote, status: "withdrawn" },
        }),
      ),
    );
    const panel = within(screen.getByRole("dialog"));
    expect(panel.getByText(changed)).toBeVisible();
    expect(panel.getByText("Withdrawn by buyer")).toBeVisible();

    // Stepping to another delivery starts again from what it shows.
    rerender(panelFor(deliveryFixture({ lotId: "10700000-0000-4000-8000-000000000007" })));
    expect(screen.queryByText(changed)).toBeNull();
  });

  it("says nothing changed when the refresh brings the same request back", () => {
    const { rerender } = render(panelFor(deliveryFixture()));
    rerender(panelFor(deliveryFixture({ destination: "12 Rue Exemple, Lyon" })));
    expect(screen.queryByText(/changed this request/)).toBeNull();
  });
});
