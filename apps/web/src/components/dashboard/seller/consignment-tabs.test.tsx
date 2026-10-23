import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConsignmentTabs } from "./consignment-tabs";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    scroll: _scroll,
    ...props
  }: { href: string; children: React.ReactNode; scroll?: boolean }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const tabs = [
  { id: "all", label: "All", count: 9, href: "/dashboard/seller/consignments", active: true },
  {
    id: "drafts",
    label: "Drafts",
    count: 1,
    href: "/dashboard/seller/consignments?tab=drafts",
    active: false,
  },
];

describe("ConsignmentTabs", () => {
  it("links each tab with its count and marks the current one", () => {
    render(<ConsignmentTabs tabs={tabs} />);
    const all = screen.getByRole("link", { name: "All 9" });
    expect(all).toHaveAttribute("aria-current", "page");
    const drafts = screen.getByRole("link", { name: "Drafts 1" });
    expect(drafts).toHaveAttribute("href", "/dashboard/seller/consignments?tab=drafts");
    expect(drafts).not.toHaveAttribute("aria-current");
  });

  it("keeps sentence case, with no capitals applied by styling", () => {
    const { container } = render(<ConsignmentTabs tabs={tabs} />);
    expect(container.innerHTML).not.toMatch(/uppercase/);
  });
});
