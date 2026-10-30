import { PlainLink } from "@auction/ui/lax";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttentionList } from "./attention-list.js";

describe("AttentionList", () => {
  it("lists only the queues with something waiting, each linking to its filtered list", () => {
    render(
      <AttentionList
        Link={PlainLink}
        items={[
          {
            id: "unpacked",
            label: "orders paid over 48 hours ago, not packed",
            count: 7,
            href: "/orders?status=paid&age=48h",
            oldest: "oldest 3 days",
            tone: "warning",
          },
          { id: "kyc", label: "KYC reviews waiting", count: 0, href: "/kyc" },
          { id: "payouts", label: "payouts failed", count: 1200, href: "/payouts?status=failed" },
        ]}
      />,
    );
    const card = screen.getByRole("region", { name: "Needs attention" });
    const links = within(card).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/orders?status=paid&age=48h");
    expect(links[0]).toHaveTextContent("7orders paid over 48 hours ago, not packedoldest 3 days");
    expect(links[1]).toHaveTextContent("1,200");
    expect(within(card).queryByText("KYC reviews waiting")).not.toBeInTheDocument();
  });

  it("keeps an item at zero when nothing left is the problem", () => {
    render(
      <AttentionList
        Link={PlainLink}
        items={[
          {
            id: "low",
            label: "Night garden: prints on sale",
            count: 0,
            href: "/artworks/a#stock",
            tone: "warning",
            keepWhenZero: true,
          },
        ]}
      />,
    );
    expect(screen.getByRole("link")).toHaveTextContent("0Night garden: prints on sale");
    expect(screen.queryByText("Nothing needs you right now.")).not.toBeInTheDocument();
  });

  it("says when nothing needs anyone, rather than showing zeros", () => {
    render(
      <AttentionList Link={PlainLink} items={[{ id: "a", label: "x", count: 0, href: "/" }]} />,
    );
    expect(screen.getByText("Nothing needs you right now.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
