import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeNeedsYou } from "./home-needs-you";
import { WelcomeCard } from "./welcome-card";

const dismissWelcomeAction = vi.fn();
vi.mock("@/lib/legal-entity/organisation-membership.actions", () => ({
  dismissWelcomeAction: (...args: unknown[]) => dismissWelcomeAction(...args),
}));

const welcome = {
  organisationId: "org-1",
  headline: "You're now a Consignor at Northbank Gallery.",
  abilities: ["send works to sell for the organisation and follow their progress"],
  identityStep: true,
};

describe("WelcomeCard", () => {
  beforeEach(() => dismissWelcomeAction.mockReset());

  it("says what the role allows, with the identity step when the role needs it", () => {
    render(<WelcomeCard welcome={welcome} organisationName="Northbank Gallery" />);
    expect(screen.getByRole("heading", { name: "Welcome to Northbank Gallery" })).toBeVisible();
    expect(screen.getByText(/send works to sell/)).toBeVisible();
    expect(screen.getByText("One step first: verify your identity.")).toBeVisible();
  });

  it("leaves the identity step out when it is not needed", () => {
    render(
      <WelcomeCard welcome={{ ...welcome, identityStep: false }} organisationName="Northbank" />,
    );
    expect(screen.queryByText("One step first: verify your identity.")).toBeNull();
  });

  it("closes for good on Got it", async () => {
    dismissWelcomeAction.mockResolvedValue({ ok: true });
    render(<WelcomeCard welcome={welcome} organisationName="Northbank Gallery" />);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByTestId("welcome-card")).toBeNull());
    expect(dismissWelcomeAction).toHaveBeenCalledWith("org-1");
  });

  it("stays and explains when closing fails", async () => {
    dismissWelcomeAction.mockResolvedValue({ ok: false, error: "Something went wrong." });
    render(<WelcomeCard welcome={welcome} organisationName="Northbank Gallery" />);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
    expect(screen.getByTestId("welcome-card")).toBeVisible();
  });
});

describe("HomeNeedsYou", () => {
  it("collapses to one line when nothing needs the member", () => {
    render(<HomeNeedsYou tasks={[]} />);
    expect(screen.getByText("Nothing needs you right now.")).toBeVisible();
  });

  it("gives each task one button", () => {
    render(
      <HomeNeedsYou
        tasks={[
          {
            key: "payouts",
            title: "Set up payouts",
            detail: "Lots can't go live until a bank account is added.",
            action: { label: "Set up", href: "/organisation/payouts" },
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Set up" })).toHaveAttribute(
      "href",
      "/organisation/payouts",
    );
  });
});
