/** @vitest-environment jsdom */
import { loadEditionFramingChoices, setBasketLineFraming } from "@/app/actions/basket.actions";
import { BasketLinesClient } from "@/components/basket/basket-lines.client";
import type { BasketLine, PublicEditionFraming } from "@auction/shop-contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("@/app/actions/basket.actions", () => ({
  addArtworkToBasket: vi.fn(),
  addMerchandiseVariantToBasket: vi.fn(),
  removeBasketLine: vi.fn(),
  setBasketLineQuantity: vi.fn(),
  setMerchandiseBasketLineQuantity: vi.fn(),
  setBasketLineFraming: vi.fn(),
  loadEditionFramingChoices: vi.fn(),
}));
vi.mock("@auction/ui/components/sheet", async () => (await import("@/test/radix-stubs")).sheet);

const setFraming = vi.mocked(setBasketLineFraming);
const loadChoices = vi.mocked(loadEditionFramingChoices);

const OAK = "00000000-0000-4000-8000-0000000000a1";
const BLACK = "00000000-0000-4000-8000-0000000000a2";
const LINE = "00000000-0000-4000-8000-000000000001";

const framed: BasketLine = {
  lineId: LINE,
  artworkSlug: "tide-line",
  artworkTitle: "Tide line",
  productVariantId: null,
  productSlug: null,
  productTitle: null,
  variantSku: null,
  unitPricePence: 18000,
  quantity: 1,
  soldOut: false,
  priceChanged: false,
  outOfStock: false,
  imageUrl: "/tide.webp",
  artistName: "Ada Rowe",
  artistSlug: "ada-rowe",
  editionSize: 30,
  editionLine: "Limited edition of 30 · Hand-signed · Numbered",
  orderLimit: 2,
  maxQuantity: 2,
  framing: {
    optionId: OAK,
    name: "Natural oak frame",
    frame: "natural_oak",
    mount: "window_conservation",
    glazing: "uv_acrylic",
    hanging: "d_rings_cord",
    pricePence: 21000,
    leadTimeMinDays: 10,
    leadTimeMaxDays: 15,
    available: true,
  },
};

const choices: PublicEditionFraming = {
  kind: "choose",
  required: false,
  description: null,
  options: [
    {
      id: OAK,
      name: "Natural oak frame",
      frame: "natural_oak",
      mount: "window_conservation",
      glazing: "uv_acrylic",
      hanging: "d_rings_cord",
      pricePence: 21000,
      leadTimeMinDays: 10,
      leadTimeMaxDays: 15,
    },
    {
      id: BLACK,
      name: "Black wood frame",
      frame: "black_wood",
      mount: "window_conservation",
      glazing: "uv_acrylic",
      hanging: "d_rings_cord",
      pricePence: 19500,
      leadTimeMinDays: 10,
      leadTimeMaxDays: 15,
    },
  ],
};

function show(lines: BasketLine[]) {
  return render(
    <BasketLinesClient
      lines={lines}
      summaryActions={<a href="/checkout">Checkout</a>}
      emptyState={<p>Your basket is empty</p>}
    />,
  );
}

describe("framing in the basket", () => {
  afterEach(() => {
    cleanup();
    setFraming.mockReset();
    loadChoices.mockReset();
    refresh.mockReset();
  });

  it("shows the frame as a sub-line of its print, with what it is made of and what it adds", () => {
    show([framed]);
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Natural oak frame")).toBeTruthy();
    expect(
      within(row).getByText(
        "White conservation mount, UV-filtering acrylic · adds 10 to 15 working days",
      ),
    ).toBeTruthy();
    expect(within(row).getByText("£210.00")).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Change framing for Tide line" })).toBeTruthy();
  });

  it("totals the line with its framing and shows the split", () => {
    show([framed]);
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("£390.00")).toBeTruthy();
    expect(within(row).getByText("£180.00 + £210.00 framing")).toBeTruthy();
  });

  it("counts the framing in the order summary", () => {
    show([framed]);
    const summary = screen.getByRole("complementary");
    expect(within(summary).getAllByText("£390.00").length).toBeGreaterThan(0);
    expect(within(summary).getByText("Total, including VAT")).toBeTruthy();
  });

  it("shows a print without framing exactly as before", () => {
    show([{ ...framed, framing: null }]);
    expect(screen.queryByText("Change framing")).toBeNull();
    expect(screen.getAllByText("£180.00").length).toBeGreaterThan(0);
  });

  it("says when the frame is no longer offered, leaves it out of the total, and keeps Change framing", () => {
    show([{ ...framed, framing: framed.framing ? { ...framed.framing, available: false } : null }]);
    const row = screen.getByRole("listitem");
    expect(
      within(row).getByText(
        "Natural oak frame is no longer offered. Choose another framing or unframed.",
      ),
    ).toBeTruthy();
    expect(within(row).queryByText("£390.00")).toBeNull();
    expect(within(row).getAllByText("£180.00").length).toBeGreaterThan(0);
    expect(within(row).getByRole("button", { name: "Change framing for Tide line" })).toBeTruthy();
  });

  it("opens the choice for the edition and changes the frame, sending only the option id", async () => {
    loadChoices.mockResolvedValue(choices);
    setFraming.mockResolvedValue({ ok: true });
    show([framed]);
    fireEvent.click(screen.getByRole("button", { name: "Change framing for Tide line" }));
    const sheet = await screen.findByRole("dialog");
    await waitFor(() => expect(within(sheet).getAllByRole("radio")).toHaveLength(3));
    expect(loadChoices).toHaveBeenCalledWith("tide-line");
    // The current frame is chosen, so there is nothing to save yet.
    expect(
      within(sheet)
        .getByRole("radio", { name: /Natural oak frame/ })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      (within(sheet).getByRole("button", { name: "Save framing" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(within(sheet).getByRole("radio", { name: /Black wood frame/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Save framing" }));
    await waitFor(() => expect(setFraming).toHaveBeenCalledWith(LINE, BLACK));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("can go unframed from the sheet", async () => {
    loadChoices.mockResolvedValue(choices);
    setFraming.mockResolvedValue({ ok: true });
    show([framed]);
    fireEvent.click(screen.getByRole("button", { name: "Change framing for Tide line" }));
    const sheet = await screen.findByRole("dialog");
    await waitFor(() => expect(within(sheet).getAllByRole("radio")).toHaveLength(3));
    fireEvent.click(within(sheet).getByRole("radio", { name: /Unframed/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Save framing" }));
    await waitFor(() => expect(setFraming).toHaveBeenCalledWith(LINE, null));
  });

  it("offers no unframed choice when the edition is sold framed only", async () => {
    loadChoices.mockResolvedValue({ ...choices, required: true });
    show([framed]);
    fireEvent.click(screen.getByRole("button", { name: "Change framing for Tide line" }));
    const sheet = await screen.findByRole("dialog");
    await waitFor(() => expect(within(sheet).getAllByRole("radio")).toHaveLength(2));
    expect(within(sheet).queryByRole("radio", { name: /Unframed/ })).toBeNull();
  });

  it("makes the shopper choose again when the frame they had is no longer on offer", async () => {
    loadChoices.mockResolvedValue({ ...choices, options: choices.options.slice(1) });
    show([framed]);
    fireEvent.click(screen.getByRole("button", { name: "Change framing for Tide line" }));
    const sheet = await screen.findByRole("dialog");
    await waitFor(() => expect(within(sheet).getAllByRole("radio")).toHaveLength(2));
    for (const radio of within(sheet).getAllByRole("radio")) {
      expect(radio.getAttribute("aria-checked")).toBe("false");
    }
    expect(
      (within(sheet).getByRole("button", { name: "Save framing" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("says why when the framing was not changed", async () => {
    loadChoices.mockResolvedValue(choices);
    setFraming.mockResolvedValue({
      ok: false,
      error: { message: "That framing is not available right now." },
    });
    show([framed]);
    fireEvent.click(screen.getByRole("button", { name: "Change framing for Tide line" }));
    const sheet = await screen.findByRole("dialog");
    await waitFor(() => expect(within(sheet).getAllByRole("radio")).toHaveLength(3));
    fireEvent.click(within(sheet).getByRole("radio", { name: /Black wood frame/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Save framing" }));
    expect(await within(sheet).findByText("That framing is not available right now.")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says so when the choices cannot be loaded", async () => {
    loadChoices.mockRejectedValue(new Error("down"));
    show([framed]);
    fireEvent.click(screen.getByRole("button", { name: "Change framing for Tide line" }));
    expect(await screen.findByText("The framing could not be loaded")).toBeTruthy();
  });
});
