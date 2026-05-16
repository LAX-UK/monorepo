import { SaleCard } from "@/components/marketing/sale-card";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SaleCard", () => {
  it("Grid wraps children in a link", () => {
    render(
      <SaleCard.Grid href="/sales/test">
        <span>Sale body</span>
      </SaleCard.Grid>,
    );
    expect(screen.getByRole("link", { name: /sale body/i })).toHaveAttribute("href", "/sales/test");
  });
});
