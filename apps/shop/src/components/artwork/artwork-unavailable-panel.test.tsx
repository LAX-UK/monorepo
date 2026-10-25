/** @vitest-environment jsdom */
import { ArtworkUnavailablePanel } from "@/components/artwork/artwork-unavailable-panel";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/artwork-interest.actions", () => ({
  registerEditionAlert: vi.fn(),
  stopEditionAlertForArtwork: vi.fn(),
}));

const member = {
  kind: "authenticated" as const,
  email: "a@example.com",
  displayName: "Alex",
  accountHref: "/account",
  logoutHref: "/logout",
};

describe("ArtworkUnavailablePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("lets a guest leave an email address without signing in", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={{ kind: "guest", loginHref: "/login", registerHref: "/register" }}
        artworkSlug="reed-study"
        reason="edition_sold_out"
        interestRead={{ status: "guest" }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Get an email if this edition is back" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Email address")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Email me" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
  });

  it("offers a signed-in shopper the account address", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={member}
        artworkSlug="reed-study"
        reason="edition_sold_out"
        interestRead={{ status: "ok", data: { subscribed: false } }}
      />,
    );
    expect(screen.getByRole("button", { name: "Email me if it is back" })).toBeTruthy();
    expect(screen.getByText("a@example.com")).toBeTruthy();
    expect(screen.queryByLabelText("Email address")).toBeNull();
  });

  it("shows a waiting alert with a way to stop it", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={member}
        artworkSlug="reed-study"
        reason="edition_sold_out"
        interestRead={{ status: "ok", data: { subscribed: true } }}
      />,
    );
    expect(screen.getByText("You are on the list")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop this alert" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Manage alerts" }).getAttribute("href")).toBe(
      "/account/orders#edition-alerts",
    );
  });

  it("still offers the alert when the saved state could not be read", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={member}
        artworkSlug="reed-study"
        reason="edition_sold_out"
        interestRead={{ status: "failed" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Email me if it is back" })).toBeTruthy();
  });

  it("falls back to the email form when the sign-in has lapsed", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={member}
        artworkSlug="reed-study"
        reason="edition_sold_out"
        interestRead={{ status: "unauthorized" }}
      />,
    );
    expect(screen.getByLabelText("Email address")).toBeTruthy();
  });

  it("does not offer an alert when the work itself is sold", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={{ kind: "guest", loginHref: "/login", registerHref: "/register" }}
        artworkSlug="sold-work"
        reason="sold"
        interestRead={{ status: "guest" }}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/no longer available to purchase/i)).toBeTruthy();
  });
});
