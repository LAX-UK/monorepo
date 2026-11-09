// @vitest-environment jsdom
import type { AdminDeliveryQuote, AdminDeliveryQuoteList } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);
vi.mock("@auction/ui/components/tooltip", async () =>
  (await import("@/test/radix-stubs")).tooltipStub(),
);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/orders/delivery-quotes",
}));
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

(await import("@/test/radix-stubs")).installLayoutStubs();
const { DeliveryQuotesView } = await import("./delivery-quotes-view.client");

const request: AdminDeliveryQuote = {
  id: "00000000-0000-4000-8000-0000000000a1",
  orderId: "00000000-0000-4000-8000-0000000000b1",
  orderReference: "LAX-S-10482",
  status: "requested",
  country: "DE",
  countryName: "Germany",
  regionName: "European Union",
  recipientName: "Anna Weber",
  address: ["Friedrichstrasse 12", "Berlin 10117", "Germany"],
  phone: "+49 30 1234567",
  items: ["Warm Basket"],
  merchandisePence: 42000,
  requestedAt: "2026-11-10T09:00:00.000Z",
  holdUntil: "2026-11-13T09:00:00.000Z",
  quote: null,
  endReason: null,
  declineNote: null,
};

const data = (overrides: Partial<AdminDeliveryQuoteList> = {}): AdminDeliveryQuoteList => ({
  items: [request],
  waitingCount: 1,
  paymentOpen: true,
  ...overrides,
});

const send = vi.fn();
const decline = vi.fn();
const actions = { send, decline } as never;

beforeEach(() => {
  send.mockReset();
  decline.mockReset();
  toastSuccess.mockReset();
});

describe("DeliveryQuotesView", () => {
  it("lists a waiting request with where it goes and what is held", () => {
    render(<DeliveryQuotesView view="waiting" data={data()} canWrite actions={actions} />);
    expect(screen.getAllByText("LAX-S-10482").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Anna Weber, Germany/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Waiting for a price").length).toBeGreaterThan(0);
  });

  it("offers no actions without order.write", () => {
    render(<DeliveryQuotesView view="waiting" data={data()} canWrite={false} actions={actions} />);
    expect(screen.queryByRole("button", { name: /quote|turn down/i })).toBeNull();
  });

  it("says plainly when buyers cannot pay yet", () => {
    render(
      <DeliveryQuotesView
        view="waiting"
        data={data({ paymentOpen: false })}
        canWrite
        actions={actions}
      />,
    );
    expect(screen.getByText(/can't pay for delivery outside the UK yet/)).toBeTruthy();
  });

  it("says each view is empty in its own words", () => {
    render(
      <DeliveryQuotesView
        view="quoted"
        data={data({ items: [], waitingCount: 0 })}
        canWrite
        actions={actions}
      />,
    );
    expect(screen.getByText("No quotes are out with buyers.")).toBeTruthy();
  });

  it("sends a quote with the price in pence and the carrier", async () => {
    send.mockResolvedValue({ ok: true, data: null });
    render(<DeliveryQuotesView view="waiting" data={data()} canWrite actions={actions} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Quote LAX-S-10482" })[0] as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Delivery price/), { target: { value: "85" } });
    fireEvent.change(within(dialog).getByLabelText(/Carrier/), {
      target: { value: " DHL Express " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send quote" }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      quoteId: request.id,
      pricePence: 8500,
      carrier: "DHL Express",
    });
  });

  it("summarises two problems and marks each field, sending nothing", async () => {
    render(<DeliveryQuotesView view="waiting" data={data()} canWrite actions={actions} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Quote LAX-S-10482" })[0] as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Send quote" }));
    expect(await within(dialog).findByText("There is a problem")).toBeTruthy();
    expect(
      within(dialog).getAllByText(/Enter the delivery price in pounds/).length,
    ).toBeGreaterThanOrEqual(2);
    expect(within(dialog).getAllByText(/Enter the carrier/).length).toBeGreaterThanOrEqual(2);
    expect(send).not.toHaveBeenCalled();
  });

  it("turns a request down only with a reason, and shows that one sentence beside the field", async () => {
    decline.mockResolvedValue({ ok: true, data: null });
    render(<DeliveryQuotesView view="waiting" data={data()} canWrite actions={actions} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Turn down LAX-S-10482" })[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn down request" }));
    expect(
      await within(dialog).findByText("Tell the buyer why we can't deliver there"),
    ).toBeTruthy();
    expect(within(dialog).queryByText("There is a problem")).toBeNull();
    expect(decline).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/Why can't we deliver/), {
      target: { value: "Our couriers cannot collect framed work there." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn down request" }));
    await waitFor(() => expect(decline).toHaveBeenCalledTimes(1));
    expect(decline.mock.calls[0]?.[0]).toMatchObject({
      quoteId: request.id,
      note: "Our couriers cannot collect framed work there.",
    });
  });

  it("lets staff revise a quote that was sent, starting from what was quoted", async () => {
    const quoted: AdminDeliveryQuote = {
      ...request,
      status: "quoted",
      quote: {
        pricePence: 9000,
        carrier: "UPS",
        service: null,
        leadTimeNote: null,
        quotedAt: "2026-11-11T09:00:00.000Z",
      },
    };
    render(
      <DeliveryQuotesView
        view="quoted"
        data={data({ items: [quoted] })}
        canWrite
        actions={actions}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Revise quote for LAX-S-10482" })[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByLabelText(/Carrier/) as HTMLInputElement).value).toBe("UPS");
    expect(within(dialog).getByRole("button", { name: "Send revised quote" })).toBeTruthy();
  });
});
