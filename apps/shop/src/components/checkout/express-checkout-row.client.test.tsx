/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpressCheckoutRow } from "./express-checkout-row.client";

vi.mock("./express-checkout-wallet.client", () => ({
  ExpressCheckoutWallet: () => <p>wallet</p>,
}));

const config = {
  publishableKey: "pk_test_abc123",
  audience: "guest" as const,
  basketId: "11111111-1111-4111-8111-111111111111",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ExpressCheckoutRow", () => {
  it("renders nothing while express checkout is off", () => {
    const { container } = render(<ExpressCheckoutRow config={null} placement="details" />);
    expect(container.innerHTML).toBe("");
  });

  it("reserves the buttons' space under its heading until the row is on screen", () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    render(<ExpressCheckoutRow config={config} placement="details" />);
    expect(screen.getByRole("heading", { name: "Express checkout" })).toBeTruthy();
    const group = screen.getByRole("group", { name: "Express checkout" });
    expect(group.getAttribute("aria-busy")).toBe("true");
    expect(group.classList.contains("shop-express__buttons--reserved")).toBe(true);
    expect(screen.getByText("Or continue below")).toBeTruthy();
    expect(screen.queryByText("wallet")).toBeNull();
  });

  it("labels the basket row 'Or pay with'", () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    render(<ExpressCheckoutRow config={config} placement="basket" />);
    expect(screen.getByRole("group", { name: "Or pay with" })).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("loads the wallet once the row is on screen", async () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(private readonly callback: IntersectionObserverCallback) {}
        observe() {
          this.callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        }
        disconnect() {}
      },
    );
    render(<ExpressCheckoutRow config={config} placement="details" />);
    expect(await screen.findByText("wallet")).toBeTruthy();
  });
});
