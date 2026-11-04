// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cancelAccountDeletionAction = vi.fn();

vi.mock("@/server/application/account-identity-actions.server", () => ({
  cancelAccountDeletionAction: () => cancelAccountDeletionAction(),
}));

const { DeletionScheduledBanner } = await import("./deletion-scheduled-banner.client");

async function keepAccount() {
  fireEvent.click(screen.getByRole("button", { name: "Keep my account" }));
  await act(async () => {});
}

describe("DeletionScheduledBanner", () => {
  beforeEach(() => cancelAccountDeletionAction.mockReset());
  afterEach(cleanup);

  function renderBanner() {
    render(<DeletionScheduledBanner dueOn="2 December" signInHref="/api/auth/login" />);
  }

  it("names the day and offers to keep the account", () => {
    renderBanner();
    expect(screen.getByText("Your account will be deleted on 2 December.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep my account" })).toBeTruthy();
  });

  it("confirms once the deletion is cancelled and removes the button", async () => {
    cancelAccountDeletionAction.mockResolvedValue({
      status: "ok",
      message: "Deletion cancelled. Your account stays as it is.",
    });
    renderBanner();
    await keepAccount();
    expect(screen.getByText("Deletion cancelled. Your account stays as it is.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Keep my account" })).toBeNull();
  });

  it("shows the error inline and keeps the banner when the action fails", async () => {
    cancelAccountDeletionAction.mockResolvedValue({ status: "error", message: "Try again." });
    renderBanner();
    await keepAccount();
    expect(screen.getByRole("alert").textContent).toContain("Try again.");
    expect(screen.getByText("Your account will be deleted on 2 December.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep my account" })).toBeTruthy();
  });

  it("links to sign in when the sign-in has ended", async () => {
    cancelAccountDeletionAction.mockResolvedValue({ status: "reauth_required" });
    renderBanner();
    await keepAccount();
    expect(screen.getByRole("alert").textContent).toContain("Your sign-in has ended");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
      "/api/auth/login",
    );
  });
});
