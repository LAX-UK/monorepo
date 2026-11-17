import {
  BOOKED_UNPAID,
  COLLECTED,
  DECLINED,
  DELIVERY_FIXTURE_NOW,
  ON_THE_WAY,
  REFUNDED,
  deliveryFixture,
} from "@/lib/admin/deliveries/deliveries.fixture";
import type { DeliveryView } from "@/lib/data/http/admin-deliveries.schema";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeliveryPanel } from "./delivery-panel";

const now = new Date(DELIVERY_FIXTURE_NOW);

function renderPanel(row = deliveryFixture(), canWork = true) {
  render(
    <StaffTooltipProvider>
      <DeliveryPanel
        row={row}
        canWork={canWork}
        panelProps={{ open: true, onOpenChange: vi.fn() }}
        now={now}
      />
    </StaffTooltipProvider>,
  );
  return within(screen.getByRole("dialog"));
}

describe("DeliveryPanel", () => {
  it("shows a declined request as Declined by LAX, with the reason the buyer was told", () => {
    const panel = renderPanel(DECLINED);
    expect(panel.getAllByText("Declined by LAX").length).toBeGreaterThanOrEqual(2);
    expect(panel.getByText("Reason given to the buyer")).toBeVisible();
    expect(panel.getByText("We can't insure a framed work of this size to Lyon.")).toBeVisible();
    expect(panel.queryByText("Withdrawn by buyer")).toBeNull();
  });

  it("puts the caller's footer actions in the panel footer, and has no footer without them", () => {
    render(
      <StaffTooltipProvider>
        <DeliveryPanel
          row={deliveryFixture()}
          canWork
          panelProps={{ open: true, onOpenChange: vi.fn() }}
          now={now}
          footerActions={<button type="button">Can't deliver</button>}
        />
      </StaffTooltipProvider>,
    );
    const footer = screen.getByRole("dialog").querySelector("[data-staff-panel-footer]");
    expect(footer).toContainElement(screen.getByRole("button", { name: "Can't deliver" }));
  });

  it("does not announce the person's own change as the buyer's", () => {
    const declined = { ...DECLINED, lotId: deliveryFixture().lotId };
    const own = { lotId: declined.lotId, key: "closed:withdrawn" };
    const props = { canWork: true, panelProps: { open: true, onOpenChange: vi.fn() }, now };
    const { rerender } = render(
      <StaffTooltipProvider>
        <DeliveryPanel row={deliveryFixture()} {...props} ownChange={null} />
      </StaffTooltipProvider>,
    );
    rerender(
      <StaffTooltipProvider>
        <DeliveryPanel row={declined} {...props} ownChange={own} />
      </StaffTooltipProvider>,
    );
    expect(screen.queryByText(/changed this request while you were looking/)).toBeNull();
  });

  it("gives what staff need to price a request: where to, the size, the hammer price, paid or not", () => {
    const panel = renderPanel();
    expect(
      panel.getByRole("heading", { level: 2, name: "Lot 42 · Harbour at dusk" }),
    ).toBeVisible();
    expect(panel.getByText("Waiting for a price")).toBeVisible();
    expect(panel.getByText("Example Trading Ltd · Paddle 118")).toBeVisible();
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

  it("shows the buyer and paddle on one line in the header, as the mockup does", () => {
    const panel = renderPanel();
    expect(panel.getByText("Example Trading Ltd · Paddle 118")).toBeVisible();
  });

  it("says when a step's time is not recorded, rather than making one up", () => {
    const panel = renderPanel(ON_THE_WAY);
    const step = panel.getByText("Handed to the courier").closest("li") as HTMLElement;
    expect(within(step).getByText("Time not recorded")).toBeVisible();
    expect(step.querySelector("time")).toBeNull();
  });

  it("closes a lot collected in person, dated when it was collected", () => {
    const panel = renderPanel(COLLECTED);
    expect(panel.getByText("Collected in person")).toBeVisible();
    const step = panel.getByText("Buyer collected it in person").closest("li") as HTMLElement;
    expect(step.querySelector("time")).toHaveAttribute("datetime", "2026-11-16T11:00:00.000Z");
  });

  it("names a refunded purchase as the purchase cancelled", () => {
    const panel = renderPanel(REFUNDED);
    expect(panel.getByText("Purchase cancelled")).toBeVisible();
    expect(panel.queryByText("Sale cancelled")).toBeNull();
  });
});

describe("DeliveryPanel states (D6)", () => {
  function Harness({
    row,
    missing = false,
    loadFailed = false,
  }: { row: DeliveryView | null; missing?: boolean; loadFailed?: boolean }) {
    return (
      <StaffTooltipProvider>
        <DeliveryPanel
          row={row}
          canWork
          panelProps={{ open: row !== null, onOpenChange }}
          now={now}
          missing={missing}
          loadFailed={loadFailed}
          onRetry={onRetry}
        />
      </StaffTooltipProvider>
    );
  }
  const onOpenChange = vi.fn();
  const onRetry = vi.fn();

  it("says a lot in the URL has no delivery, with a way back to the list", () => {
    onOpenChange.mockReset();
    render(<Harness row={null} missing />);
    const panel = within(screen.getByRole("dialog"));
    expect(panel.getByText("This delivery could not be found")).toBeVisible();
    expect(
      panel.getByText("No buyer has asked for delivery on this lot, or the link is out of date."),
    ).toBeVisible();
    fireEvent.click(panel.getByRole("button", { name: "Back to the list" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says a failed read could not be loaded, with Try again, and never calls it not found", () => {
    onOpenChange.mockReset();
    onRetry.mockReset();
    render(<Harness row={null} missing loadFailed />);
    const panel = within(screen.getByRole("dialog"));
    const alert = within(panel.getByRole("alert"));
    expect(alert.getByText("This delivery could not be loaded. Try again.")).toBeVisible();
    expect(panel.queryByText("This delivery could not be found")).toBeNull();
    fireEvent.click(alert.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(alert.getByRole("button", { name: "Back to the list" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays closed when no lot is open", () => {
    render(<Harness row={null} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says the buyer changed the request when it moves on while open", () => {
    const first = deliveryFixture();
    const { rerender } = render(<Harness row={first} />);
    expect(screen.queryByText(/The buyer changed this request/)).toBeNull();
    // The list refreshed: the same lot, now withdrawn by the buyer.
    rerender(
      <Harness
        row={deliveryFixture({
          status: "closed",
          closedReason: "withdrawn",
          quote: { ...first.quote, status: "withdrawn" },
        })}
      />,
    );
    expect(
      screen.getByText("The buyer changed this request while you were looking at it."),
    ).toBeVisible();
  });

  it("starts again when the same lot is opened again after its panel closed", () => {
    const first = deliveryFixture();
    const { rerender } = render(<Harness row={first} />);
    rerender(<Harness row={null} />);
    // Reopened later, already quoted: that is what this opening first shows, not a change.
    rerender(
      <Harness
        row={deliveryFixture({ status: "quoted", quote: { ...first.quote, status: "quoted" } })}
      />,
    );
    expect(screen.queryByText(/The buyer changed this request/)).toBeNull();
  });

  it("does not call another lot a change: stepping to the next row starts again", () => {
    const { rerender } = render(<Harness row={deliveryFixture()} />);
    rerender(<Harness row={ON_THE_WAY} />);
    rerender(<Harness row={{ ...ON_THE_WAY, lotId: "10700000-0000-4000-8000-000000000007" }} />);
    expect(screen.queryByText(/The buyer changed this request/)).toBeNull();
  });
});

describe("DeliveryPanel beside the list", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  it("sits beside the list from 1280px, with no scrim, so the list stays in use", () => {
    window.matchMedia = (query: string) =>
      ({
        matches: query === "(min-width: 80rem)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList;
    renderPanel();
    expect(document.querySelector("[data-staff-panel-beside]")).not.toBeNull();
    expect(document.querySelector("[data-lax-motion='scrim']")).toBeNull();
  });

  it("is the usual panel over the list on a narrower screen", () => {
    renderPanel();
    expect(document.querySelector("[data-staff-panel-beside]")).toBeNull();
    expect(document.querySelector("[data-lax-motion='scrim']")).not.toBeNull();
  });
});
