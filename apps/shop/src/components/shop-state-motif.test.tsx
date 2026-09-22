/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShopStateMotif } from "./shop-state-motif";

afterEach(cleanup);

describe("ShopStateMotif", () => {
  it.each(["empty", "search", "bag"] as const)(
    "renders the shared hatched motif for %s",
    (variant) => {
      render(<ShopStateMotif variant={variant} />);
      const testId =
        variant === "empty"
          ? "marketing-status-motif-gallery"
          : `marketing-status-motif-${variant}`;
      expect(screen.getByTestId(testId)).toBeTruthy();
    },
  );

  it("renders alert motif without promotional photography", () => {
    render(<ShopStateMotif variant="alert" />);
    expect(screen.getByTestId("marketing-status-motif-alert")).toBeTruthy();
  });
});
