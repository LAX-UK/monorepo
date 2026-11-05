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
  availability: "available",
};

const DELIVERY = "Insured UK delivery £15, arrives 2 to 4 Nov · Free collection, ready Fri 30 Oct";

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
      deliveryLine={DELIVERY}
      deliveryHref={null}
      editionLine="Limited edition of 24 · Hand-signed"
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

  it("shows the price with VAT, the action and one delivery line, and no edition line", () => {
    renderBuyBox();
    expect(screen.getByText("£120.00")).toBeTruthy();
    expect(screen.getByText("Includes VAT")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add to basket" })).toBeTruthy();
    expect(screen.getByText(DELIVERY)).toBeTruthy();
    expect(screen.queryByText(/Limited edition of 24/)).toBeNull();
    expect(screen.queryByText("Available")).toBeNull();
  });

  it("links the delivery line to the policy when it is live", () => {
    renderBuyBox({ deliveryHref: "/delivery" });
    expect(screen.getByRole("link", { name: DELIVERY }).getAttribute("href")).toBe("/delivery");
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

  it("says 'In your basket · View basket' when the edition is already in it", () => {
    renderBuyBox({ inBasket: true, basketLineId: "line-1" });
    expect(screen.getByRole("link", { name: "View basket" }).getAttribute("href")).toBe("/basket");
    expect(screen.getByText(/In your basket/).textContent).toBe("In your basket · View basket");
    expect(screen.queryByRole("button", { name: "Add to basket" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove from basket" })).toBeTruthy();
  });
});
