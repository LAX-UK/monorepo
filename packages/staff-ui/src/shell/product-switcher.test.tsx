import { render, screen, within } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

// Radix menus position and trap focus in jsdom. These stand-ins render the trigger and the open
// list so the switcher's own decision, which tools to list, is what is tested.
vi.mock("@auction/ui/components/dropdown-menu", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: ({
      children,
      "aria-label": label,
    }: { children?: React.ReactNode; "aria-label"?: string }) => (
      <span aria-label={label}>{children}</span>
    ),
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => (
      <ul aria-label="Staff tools menu">{children}</ul>
    ),
    DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
    DropdownMenuLabel: Pass,
    DropdownMenuCheckboxItem: Pass,
    DropdownMenuRadioGroup: Pass,
    DropdownMenuRadioItem: Pass,
    DropdownMenuSeparator: () => null,
  };
});
vi.mock("@auction/ui/components/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
  TooltipContent: () => null,
}));

const { ProductSwitcher } = await import("./product-switcher.js");
const { buildStaffProducts } = await import("./staff-products.js");

const hrefs = { "bid-admin": "https://bid.example.test/admin", "lax-admin": "/" };

describe("ProductSwitcher with the tools a person can open", () => {
  it("is a plain heading when the other tool is not accessible", () => {
    const products = buildStaffProducts({ current: "lax-admin", accessible: [], hrefs });
    render(<ProductSwitcher current={products[0] as never} products={products} />);

    expect(screen.getByText("LAX Admin")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Switch staff tool/)).not.toBeInTheDocument();
    expect(screen.queryByText("Bid admin")).not.toBeInTheDocument();
  });

  it("lists both tools, marking the current one, when the other is accessible", () => {
    const products = buildStaffProducts({
      current: "lax-admin",
      accessible: ["bid-admin"],
      hrefs,
    });
    const current = products.find((p) => p.id === "lax-admin");
    render(<ProductSwitcher current={current as never} products={products} />);

    expect(screen.getByLabelText("LAX Admin. Switch staff tool")).toBeInTheDocument();
    const menu = screen.getByRole("list", { name: "Staff tools menu" });
    expect(within(menu).getByRole("link", { name: /Bid admin/ })).toHaveAttribute(
      "href",
      "https://bid.example.test/admin",
    );
    expect(within(menu).getByRole("link", { name: /LAX Admin/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
