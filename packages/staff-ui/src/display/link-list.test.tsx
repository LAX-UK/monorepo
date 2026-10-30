import { PlainLink } from "@auction/ui/lax";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinkList } from "./link-list.js";

describe("LinkList", () => {
  it("names the card and links each place, with a count only when something waits", () => {
    render(
      <LinkList
        title="Finance tools"
        Link={PlainLink}
        items={[
          {
            id: "payouts",
            label: "Payouts",
            description: "Transfers to sellers",
            href: "/payouts",
            count: 3,
          },
          { id: "xero", label: "Xero", href: "/xero", count: 0 },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Finance tools" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/payouts");
    expect(links[0]).toHaveTextContent("PayoutsTransfers to sellers3");
    expect(links[1]).toHaveTextContent(/^Xero$/);
  });

  it("renders nothing without places", () => {
    const { container } = render(<LinkList title="Empty" Link={PlainLink} items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
