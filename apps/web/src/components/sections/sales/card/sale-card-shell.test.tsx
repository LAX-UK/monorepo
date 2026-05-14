import { SaleCardShell } from "@/components/sections/sales/card/sale-card-shell";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SaleCardShell", () => {
  it("renders children and applies shell surface classes", () => {
    render(
      <SaleCardShell>
        <p>Inside</p>
      </SaleCardShell>,
    );
    expect(screen.getByText("Inside")).toBeInTheDocument();
    const shell = screen.getByText("Inside").parentElement;
    expect(shell).toHaveClass("rounded-lg", "bg-page-bg", "outline", "focus-within:ring-2");
  });
});
