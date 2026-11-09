/** @vitest-environment jsdom */
import { addArtworkToBasket } from "@/app/actions/basket.actions";
import { ArtworkBuyBox } from "@/components/artwork/artwork-buy-box.client";
import { ArtworkFramingProvider } from "@/components/artwork/artwork-framing-context.client";
import { ArtworkGallery } from "@/components/artwork/artwork-gallery.client";
import { type ArtworkFramingVm, presentArtworkFraming } from "@/lib/artwork/artwork-framing.vm";
import type { ArtworkGalleryVm } from "@/lib/artwork/artwork-product-page.vm";
import type { ArtworkPurchaseVm } from "@/lib/presenters/artwork-purchase.presenter";
import type { PublicEditionFraming, PublicFramingOption } from "@auction/shop-contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    // biome-ignore lint/a11y/useAltText: alt is passed through from props
    <img {...props} />
  ),
}));
vi.mock("@/app/actions/basket.actions", () => ({
  addArtworkToBasket: vi.fn(),
  removeBasketLine: vi.fn(),
}));
vi.mock("@auction/ui/components/sheet", async () => (await import("@/test/radix-stubs")).sheet);
vi.mock("@auction/ui/components/dialog", async () => (await import("@/test/radix-stubs")).dialog);

const addMock = vi.mocked(addArtworkToBasket);

const OAK = "00000000-0000-4000-8000-0000000000a1";
const BLACK = "00000000-0000-4000-8000-0000000000a2";

const option = (id: string, name: string, overrides: Partial<PublicFramingOption> = {}) =>
  ({
    id,
    name,
    frame: "natural_oak",
    mount: "window_conservation",
    glazing: "uv_acrylic",
    hanging: "d_rings_cord",
    pricePence: 21000,
    leadTimeMinDays: 10,
    leadTimeMaxDays: 15,
    ...overrides,
  }) satisfies PublicFramingOption;

const NOW = new Date("2026-11-02T10:00:00.000Z");
const TIMES = { ukDelivery: { min: 3, max: 5 }, collection: { min: 2, max: 2 } };

function vmFor(framing: PublicEditionFraming): ArtworkFramingVm {
  return presentArtworkFraming({ framing, printPricePence: 18000, now: NOW, times: TIMES });
}

const choose = (required = false): PublicEditionFraming => ({
  kind: "choose",
  required,
  description: null,
  options: [
    option(OAK, "Natural oak frame"),
    option(BLACK, "Black wood frame", { frame: "black_wood", pricePence: 19500 }),
  ],
});

const purchase: ArtworkPurchaseVm = {
  priceLabel: "£180",
  vatNote: "Includes VAT",
  availability: "available",
};

const gallery: ArtworkGalleryVm = {
  images: [{ url: "/front.webp", alt: "Tide line by Ada Rowe" }],
  scale: null,
};

function renderEdition(
  framing: PublicEditionFraming,
  props: Partial<React.ComponentProps<typeof ArtworkBuyBox>> = {},
) {
  const vm = vmFor(framing);
  const buy = (
    <>
      <ArtworkGallery title="Tide line" gallery={gallery} />
      <ArtworkBuyBox
        slug="tide-line"
        title="Tide line"
        artistName="Ada Rowe"
        imageUrl="/front.webp"
        purchase={purchase}
        inBasket={false}
        basketLineId={null}
        signInHref="/login"
        deliveryLine="Insured UK delivery £15, arrives 5 to 9 Nov · Free collection, ready Wed 4 Nov"
        deliveryHref={null}
        editionLine={null}
        returnsHref="/returns"
        framing={vm.kind === "framed_by_artist" || vm.kind === "unavailable" ? vm : null}
        {...props}
      />
    </>
  );
  return render(
    vm.kind === "choose" ? <ArtworkFramingProvider vm={vm}>{buy}</ArtworkFramingProvider> : buy,
  );
}

describe("the framing choice on the edition page", () => {
  afterEach(() => {
    cleanup();
    addMock.mockReset();
    refresh.mockReset();
  });

  it("looks as it did before when the edition has no framing", () => {
    renderEdition({ kind: "none", required: false, description: null, options: [] });
    expect(screen.queryByText("Framing")).toBeNull();
    expect(screen.getByText("£180")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add to basket" })).toBeTruthy();
  });

  it("offers unframed first and chosen, then each option with what it adds", () => {
    renderEdition(choose());
    const group = screen.getByRole("radiogroup");
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]?.getAttribute("aria-checked")).toBe("true");
    expect(within(group).getByText("Unframed")).toBeTruthy();
    expect(within(group).getByText("+£210")).toBeTruthy();
    expect(within(group).getByText("+£195")).toBeTruthy();
    expect(
      within(group).getAllByText("White conservation mount, UV-filtering acrylic"),
    ).toHaveLength(2);
    expect(screen.getByText("Unframed · includes VAT")).toBeTruthy();
  });

  it("follows the choice: the total, the button, the delivery dates and the picture", () => {
    const { container } = renderEdition(choose());
    expect(container.querySelector(".shop-gallery__mat[data-frame]")).toBeNull();
    expect(screen.getByText(/arrives 5 to 9 Nov/)).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /Natural oak frame/ }));

    expect(screen.getAllByText("£390").length).toBeGreaterThan(0);
    expect(screen.getByText("With natural oak frame · includes VAT")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add to basket" })).toBeTruthy();
    expect(screen.getByText(/arrives 19 to 30 Nov/)).toBeTruthy();
    expect(container.querySelector(".shop-gallery__mat[data-frame='natural_oak']")).not.toBeNull();
    expect(screen.getByText("Shown framed. Illustration of the frame, not to scale.")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /Unframed/ }));
    expect(screen.getByRole("button", { name: "Add to basket" })).toBeTruthy();
    expect(container.querySelector(".shop-gallery__mat[data-frame]")).toBeNull();
    expect(screen.queryByText(/Shown framed/)).toBeNull();
  });

  it("sends only the option id with the add, and null for unframed", async () => {
    addMock.mockResolvedValue({ ok: true });
    renderEdition(choose());
    fireEvent.click(screen.getByRole("button", { name: "Add to basket" }));
    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1));
    expect(addMock).toHaveBeenLastCalledWith("tide-line", 1, null);
    cleanup();

    addMock.mockClear();
    renderEdition(choose());
    fireEvent.click(screen.getByRole("radio", { name: /Black wood frame/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add to basket" }));
    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1));
    expect(addMock).toHaveBeenLastCalledWith("tide-line", 1, BLACK);
  });

  it("confirms the add with the frame it went in with", async () => {
    addMock.mockResolvedValue({ ok: true });
    renderEdition(choose());
    fireEvent.click(screen.getByRole("radio", { name: /Natural oak frame/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add to basket" }));
    expect(await screen.findByText("With natural oak frame")).toBeTruthy();
  });

  it("has no default when sold framed only; the button stays enabled and, pressed, takes the shopper to the choice", async () => {
    renderEdition(choose(true));
    expect(
      screen.getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false"),
    ).toBe(true);
    expect(screen.queryByRole("radio", { name: /Unframed/ })).toBeNull();
    const button = screen.getByRole("button", { name: "Add to basket" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    // The hint is not there until Add is pressed.
    expect(
      screen.queryByText("This edition is sold framed. Choose a frame.", {
        selector: "p.shop-buy__hint",
      }),
    ).toBeNull();

    fireEvent.click(button);

    expect(addMock).not.toHaveBeenCalled();
    const hint = await screen.findByText("This edition is sold framed. Choose a frame.", {
      selector: "p.shop-buy__hint",
    });
    // The visible hint is plain text that describes the button; the live region says it once.
    expect(hint.getAttribute("role")).toBeNull();
    expect(button.getAttribute("aria-describedby")).toBe(hint.id);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    const announced = screen
      .getAllByRole("status")
      .filter((node) => node.textContent === "This edition is sold framed. Choose a frame.");
    expect(announced).toHaveLength(1);
    expect(document.activeElement?.getAttribute("role")).toBe("radio");
    expect(document.activeElement?.closest(".shop-framing")).not.toBeNull();

    // Choosing a frame clears the hint and the button adds it.
    addMock.mockResolvedValue({ ok: true });
    fireEvent.click(screen.getByRole("radio", { name: /Natural oak frame/ }));
    expect(
      screen.queryByText("This edition is sold framed. Choose a frame.", {
        selector: "p.shop-buy__hint",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add to basket" }).getAttribute("aria-describedby"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add to basket" }));
    await waitFor(() => expect(addMock).toHaveBeenCalledWith("tide-line", 1, OAK));
  });

  it("opens the framing details with what each frame is made of", () => {
    renderEdition(choose());
    fireEvent.click(screen.getByRole("button", { name: "See framing details" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Framing details")).toBeTruthy();
    expect(within(dialog).getAllByText("D-rings and cord").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("10 to 15 working days").length).toBeGreaterThan(0);
    expect(within(dialog).getByRole("link", { name: "Returns policy" }).getAttribute("href")).toBe(
      "/returns",
    );
  });

  it("describes a print that comes framed, with no choice", () => {
    renderEdition({
      kind: "framed_by_artist",
      required: false,
      description: "Oak frame made by the artist",
      options: [],
    });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByText(/Oak frame made by the artist/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add to basket" })).toBeTruthy();
  });

  it("keeps the button label plain, whatever the frame costs", () => {
    renderEdition(choose());
    fireEvent.click(screen.getByRole("radio", { name: /Natural oak frame/ }));
    const button = screen.getByRole("button", { name: "Add to basket" });
    expect(button.textContent).toBe("Add to basket");
    expect(screen.getAllByText("£390").length).toBeGreaterThan(0);
  });

  it("cannot be ordered when sold framed only and no frame is on offer", () => {
    renderEdition({ kind: "unavailable", required: true, description: null, options: [] });
    expect(screen.getByText("Not available to order right now.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Add to basket" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("hides the choice once the print is in the basket, where the basket holds the framing", () => {
    renderEdition(choose(), { inBasket: true, basketLineId: "line-1" });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByText("In your basket")).toBeTruthy();
    expect(screen.getByText("£180")).toBeTruthy();
  });
});
