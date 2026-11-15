import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const terms = vi.fn();
vi.mock("@/lib/data/http/public-catalogue.server", () => ({
  getPublicPlaceStorageTerms: () => terms(),
}));
vi.mock("@/components/marketing/policy-hub-layout", () => ({
  PolicyHubLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import ShippingPage from "./page";

const SENTENCE =
  "Storage is free for 14 days after your payment clears. After that it is £3 a day for each work, or £6 for works over 150 cm on any side, plus VAT where it applies.";

beforeEach(() => terms.mockReset());

describe("the shipping page's storage section", () => {
  it("prints the terms of the one place that takes bookings", async () => {
    terms.mockResolvedValue([{ placeName: "LAX Gallery", text: SENTENCE }]);
    render(await ShippingPage());
    expect(screen.getByText(SENTENCE)).toBeInTheDocument();
  });

  it("names each place when the terms differ", async () => {
    terms.mockResolvedValue([
      { placeName: "LAX Gallery", text: SENTENCE },
      {
        placeName: "LAX Marylebone",
        text: "Storage is free for 7 days after your payment clears.",
      },
    ]);
    render(await ShippingPage());
    expect(screen.getByText("LAX Marylebone.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").some((li) => li.textContent?.includes("7 days"))).toBe(
      true,
    );
  });

  it("keeps the standing wording when no place has set terms", async () => {
    terms.mockResolvedValue([]);
    render(await ShippingPage());
    expect(screen.getByText(/storage charges may apply/)).toBeInTheDocument();
    expect(screen.queryByText(SENTENCE)).toBeNull();
  });
});
