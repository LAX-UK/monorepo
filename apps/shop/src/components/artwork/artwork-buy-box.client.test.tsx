/** @vitest-environment jsdom */
import { addArtworkToBasket } from "@/app/actions/basket.actions";
import { ArtworkBuyBox } from "@/components/artwork/artwork-buy-box.client";
import type { ArtworkPurchaseVm } from "@/lib/presenters/artwork-purchase.presenter";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/actions/basket.actions", () => ({
  addArtworkToBasket: vi.fn(),
  removeBasketLine: vi.fn(),
}));
vi.mock("@auction/ui/components/sheet", async () => (await import("@/test/radix-stubs")).sheet);

const addMock = vi.mocked(addArtworkToBasket);

const purchase: ArtworkPurchaseVm = {
  priceLabel: "£120.00",
  vatNote: "Includes VAT",
  editionSize: "Limited edition of 24",
  editionShort: "Edition of 24",
  availability: "available",
  availabilityLabel: "Available",
  deliveryLine: "UK insured delivery £15.00 · Collection in London free",
  returnsLine: "14-day cancellation",
};

function renderBuyBox(props: Partial<React.ComponentProps<typeof ArtworkBuyBox>> = {}) {
  return render(
    <ArtworkBuyBox
      slug="warm-basket"
      title="Warm Basket"
      artistName="Emmett King"
      imageUrl="/warm-basket.webp"
      purchase={purchase}
      inBasket={false}
      basketLineId={null}
      signInHref="/login?returnTo=%2Fartworks%2Fwarm-basket"
      facts={<p>{purchase.deliveryLine}</p>}
      {...props}
    />,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("ArtworkBuyBox", () => {
  afterEach(() => {
    cleanup();
    addMock.mockReset();
    refresh.mockReset();
  });

  it("shows the price with VAT, the edition line and the delivery line", () => {
    renderBuyBox();
    expect(screen.getByText("£120.00")).toBeTruthy();
    expect(screen.getByText("Includes VAT")).toBeTruthy();
    expect(screen.getByText(/Limited edition of 24/)).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
    expect(screen.getByText(/UK insured delivery £15.00/)).toBeTruthy();
  });

  it("adds one edition: loading, then added, the confirmation, an announcement and a header refresh", async () => {
    const pending = deferred<{ ok: true }>();
    addMock.mockReturnValue(pending.promise as never);
    renderBuyBox();

    fireEvent.click(screen.getByRole("button", { name: "Add to basket" }));
    const loading = screen.getByRole("button", { name: /Adding/ });
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.hasAttribute("disabled")).toBe(true);
    expect(addMock).toHaveBeenCalledWith("warm-basket", 1);

    await act(async () => pending.resolve({ ok: true }));

    expect(screen.getByRole("button", { name: /Added to basket/ })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Warm Basket added to your basket.");
    expect(screen.getByText("Added to your basket")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View basket" }).getAttribute("href")).toBe("/basket");
    expect(screen.getByRole("button", { name: "Continue shopping" })).toBeTruthy();
    expect(refresh).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Continue shopping" }));
    expect(screen.queryByText("Added to your basket")).toBeNull();
  });

  it("says a sold-out edition could not be added, without a count", async () => {
    addMock.mockResolvedValue({
      ok: false,
      error: { error: "commerce_upstream_failed", code: "shop.out_of_stock" },
    } as never);
    renderBuyBox();
    fireEvent.click(screen.getByRole("button", { name: "Add to basket" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "This edition has just sold out, so it could not be added to your basket.",
    );
    expect(screen.getByRole("button", { name: "Add to basket" })).toBeTruthy();
  });

  it("asks a guest to sign in and come back", async () => {
    addMock.mockResolvedValue({ ok: false, error: { error: "sign_in_required" } } as never);
    renderBuyBox();
    fireEvent.click(screen.getByRole("button", { name: "Add to basket" }));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
        "/login?returnTo=%2Fartworks%2Fwarm-basket",
      ),
    );
  });

  it("offers the basket when the edition is already in it", () => {
    renderBuyBox({ inBasket: true, basketLineId: "line-1" });
    expect(screen.getByRole("link", { name: "View basket" })).toBeTruthy();
    expect(screen.getByText(/In your basket/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add to basket" })).toBeNull();
  });
});
