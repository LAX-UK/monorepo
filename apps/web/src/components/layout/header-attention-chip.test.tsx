import { AttentionChipLink } from "@/components/layout/header-attention-chip";
import type { AttentionChip } from "@/lib/navigation/client-attention";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LONG = "Untitled (study for the north window, with the harbour wall and the gulls)";

function chip(over: Partial<AttentionChip> = {}): AttentionChip {
  return {
    kind: "outbid",
    label: `Outbid on ${LONG}`,
    href: "/lot/untitled/l2#price",
    accessibleName: `Outbid on ${LONG}. Go to the lot`,
    ...over,
  };
}

describe("AttentionChipLink", () => {
  it("shows the work's name and reads it in full when the visible text truncates", () => {
    render(<AttentionChipLink chip={chip()} />);
    const link = screen.getByRole("link", { name: `Outbid on ${LONG}. Go to the lot` });
    expect(link).toHaveAttribute("href", "/lot/untitled/l2#price");
    expect(link.querySelector(".truncate")).toHaveTextContent(`Outbid on ${LONG}`);
  });

  it("links to My bids when several lots are outbid", () => {
    render(
      <AttentionChipLink
        chip={chip({
          label: "Outbid on 2 lots",
          href: "/bids?tab=active",
          accessibleName: "Outbid on 2 lots. Go to My bids",
        })}
      />,
    );
    expect(screen.getByRole("link", { name: /Go to My bids/ })).toHaveAttribute(
      "href",
      "/bids?tab=active",
    );
  });
});
