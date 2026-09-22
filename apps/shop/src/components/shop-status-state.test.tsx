/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShopStatusState, ShopStatusStateLink } from "./shop-status-state";

afterEach(cleanup);

describe("ShopStatusState", () => {
  it("renders static empty states without live-region semantics", () => {
    render(
      <ShopStatusState
        variant="empty"
        icon="bag"
        layout="page"
        title="Your basket is empty"
        description="Add an artwork to continue."
        actions={
          <ShopStatusStateLink href="/artworks" priority="primary">
            Browse artworks
          </ShopStatusStateLink>
        }
      />,
    );

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("marketing-status-motif-bag")).toBeTruthy();
    expect(document.querySelector(".marketing-status-state--page")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse artworks" }).getAttribute("href")).toBe(
      "/artworks",
    );
  });

  it("announces banner errors assertively", () => {
    render(
      <ShopStatusState
        variant="error"
        title="Temporarily unavailable"
        description="Try again."
        className="shop-status-state--banner"
      />,
    );

    expect(screen.getByRole("alert").getAttribute("aria-live")).toBe("assertive");
  });

  it("allows callers to override announcement for client transitions", () => {
    render(
      <ShopStatusState
        variant="empty"
        title="No matches"
        description="Adjust filters."
        announcement="polite"
      />,
    );

    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });

  it("keeps page errors static without a live region", () => {
    render(
      <ShopStatusState
        variant="error"
        title="Something went wrong"
        description="Try again."
        className="shop-status-state--page"
      />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("marketing-status-motif-alert")).toBeTruthy();
  });
});
