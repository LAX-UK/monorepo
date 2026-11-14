import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const browserFetch = vi.fn();

vi.mock("@/lib/data/http/hc-browser", () => ({
  browserApiBase: () => "https://api.lax.test",
  browserFetch: (...args: unknown[]) => browserFetch(...args),
}));
vi.mock("@/lib/legal-entity/submissions-access-actions", () => ({
  usePersonalProfileForSubmissions: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { TelephoneBidDetailContent } from "./telephone-bid-detail-content";

const answer = (status: number) => new Response(JSON.stringify({ error: "x" }), { status });

describe("TelephoneBidDetailContent when the booking is not shown", () => {
  beforeEach(() => {
    browserFetch.mockReset();
  });

  it.each([404, 403])(
    "answers a missing or someone else's booking (%i) as not found, with only the way back",
    async (status) => {
      browserFetch.mockResolvedValue(answer(status));
      render(<TelephoneBidDetailContent bookingId="booking-1" />);
      expect(
        await screen.findByRole("heading", { name: "We can't find this telephone booking" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Back to bids" })).toHaveAttribute(
        "href",
        "/bids#telephone-bids",
      );
      expect(screen.queryByRole("link", { name: "Try again" })).not.toBeInTheDocument();
      expect(screen.queryByText(/couldn't be loaded/)).not.toBeInTheDocument();
    },
  );

  it("offers Try again only when the request failed", async () => {
    browserFetch.mockResolvedValue(answer(500));
    render(<TelephoneBidDetailContent bookingId="booking-1" />);
    expect(
      await screen.findByRole("heading", { name: "This telephone booking couldn't be loaded" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/bids/telephone/booking-1",
    );
    expect(screen.getByRole("link", { name: "Back to bids" })).toBeInTheDocument();
  });
});
