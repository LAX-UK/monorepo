import { BidAttentionPromptChip } from "@/components/layout/bid-attention-prompt-chip";
import type { BidAttention } from "@/hooks/use-bid-attention";
import type { AttentionChip } from "@/lib/navigation/client-attention";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let state: BidAttention;
vi.mock("@/hooks/use-bid-attention", () => ({ useBidAttention: () => state }));

const chip = (kind: AttentionChip["kind"], label: string, href: string): BidAttention => ({
  signedIn: true,
  viewer: { displayName: "Jordan Hale", email: "jordan@example.com" },
  pending: false,
  attention: null,
  chip: { kind, label, href, accessibleName: `${label}. Go` },
});

describe("BidAttentionPromptChip", () => {
  it("renders nothing for a guest or when nothing is pressing", () => {
    state = { signedIn: false, viewer: null, pending: false, attention: null, chip: null };
    const { container } = render(<BidAttentionPromptChip placement="strip" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says 'Payment due' with 'Pay now ›' in the strip", () => {
    state = chip("payment-due", "Payment due", "/purchases");
    render(<BidAttentionPromptChip placement="strip" />);
    const strip = screen.getByTestId("attention-strip");
    expect(strip).toHaveTextContent("Payment duePay now›");
    expect(strip).toHaveAttribute("href", "/purchases");
    expect(strip.className).toContain("bg-warning-container");
  });

  it.each([
    ["outbid", "Outbid on Harbour at Dawn", "bg-danger-container"],
    ["account-in-review", "Account in review", "bg-info-container"],
    ["payment-due", "Payment due", "bg-warning-container"],
  ] as const)("keeps the %s rule and tone from the chip", (kind, label, tone) => {
    state = chip(kind, label, "/x");
    render(<BidAttentionPromptChip placement="strip" />);
    expect(screen.getByTestId("attention-strip")).toHaveTextContent(label);
    expect(screen.getByTestId("attention-strip").className).toContain(tone);
  });

  it("shows the strip only below 640px and the chip only from 640px", () => {
    state = chip("payment-due", "Payment due", "/purchases");
    const { rerender } = render(<BidAttentionPromptChip placement="strip" />);
    expect(screen.getByTestId("attention-strip").parentElement?.className).toContain("sm:hidden");
    rerender(<BidAttentionPromptChip placement="bar" />);
    expect(screen.getByTestId("attention-chip").parentElement?.className).toContain(
      "max-sm:hidden",
    );
  });

  it("reads the full sentence aloud", () => {
    state = chip("account-in-review", "Account in review", "/purchases");
    render(<BidAttentionPromptChip placement="strip" />);
    // The strip and the chip are one prompt in two forms; CSS shows exactly one of them.
    const links = screen.getAllByRole("link", { name: "Account in review. Go" });
    expect(links).toHaveLength(2);
    expect(new Set(links.map((link) => link.getAttribute("href")))).toEqual(
      new Set(["/purchases"]),
    );
  });
});
