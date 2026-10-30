// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/legal-entity/submissions-access-actions", () => ({
  usePersonalProfileForSubmissions: vi.fn(),
}));

const { ConnectLoadFailure } = await import("./connect-load-failure");

describe("ConnectLoadFailure", () => {
  it("shows an unreachable payout account as a calm notice with a way to contact us", () => {
    render(<ConnectLoadFailure error="account_unreachable" />);
    expect(screen.getByText("We can't reach your payout account right now")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:/),
    );
    expect(screen.queryByText("Could not load payout setup")).not.toBeInTheDocument();
  });

  it("keeps the load error for a real failure", () => {
    render(<ConnectLoadFailure error="server_error" />);
    expect(screen.getByText("Could not load payout setup")).toBeInTheDocument();
  });
});
