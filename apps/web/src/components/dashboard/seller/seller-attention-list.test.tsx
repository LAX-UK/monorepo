import type { SellerAttentionItem } from "@/lib/seller/seller-attention";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SellerAttentionList } from "./seller-attention-list";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const items: SellerAttentionItem[] = [
  {
    id: "draft:s1",
    title: 'Finish "Moonlit quay"',
    detail: "Saved but not yet sent to our specialists for review.",
    status: "Not submitted",
    href: "/selling/consignments/s1",
  },
  {
    id: "payout-setup",
    title: "Finish payout setup",
    detail: "We can only pay you once your bank details are verified.",
    status: "To do",
    href: "/selling/payout-setup",
  },
];

describe("SellerAttentionList", () => {
  it("is a list under its own heading", () => {
    render(<SellerAttentionList items={items} />);
    expect(screen.getByRole("heading", { name: "Needs your attention" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("makes each whole row one link with its title, detail and status", () => {
    render(<SellerAttentionList items={items} />);
    const [first] = screen.getAllByRole("listitem");
    const link = within(first as HTMLElement).getByRole("link");
    expect(link).toHaveAttribute("href", "/selling/consignments/s1");
    expect(link).toHaveTextContent('Finish "Moonlit quay"');
    expect(link).toHaveTextContent("Saved but not yet sent");
    expect(link.textContent).toMatch(/Not submitted/);
  });

  it("says so, with no list, when nothing needs attention", () => {
    render(<SellerAttentionList items={[]} />);
    expect(screen.getByText("Nothing needs your attention right now.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows no numbers or KPI tiles", () => {
    const { container } = render(<SellerAttentionList items={items} />);
    expect(container.querySelector("[data-kpi]")).toBeNull();
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });
});
