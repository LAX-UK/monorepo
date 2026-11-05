import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadAccountAlerts = vi.fn();
const setAlertTopic = vi.fn();
const success = vi.fn();
const error = vi.fn();
vi.mock("@/lib/data/http/alerts.client", () => ({
  loadAccountAlerts: (...a: unknown[]) => loadAccountAlerts(...a),
  setAlertTopic: (...a: unknown[]) => setAlertTopic(...a),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (m: string) => success(m), error: (m: string) => error(m) },
}));

import { HomeAlertsSignedIn } from "./home-alerts-signed-in";

beforeEach(() => {
  for (const fn of [loadAccountAlerts, setAlertTopic, success, error]) fn.mockReset();
});
afterEach(cleanup);

describe("HomeAlertsSignedIn", () => {
  it("offers one press when alerts are off, with a link to the settings", async () => {
    loadAccountAlerts.mockResolvedValue({ state: "none", topics: [] });
    render(<HomeAlertsSignedIn />);
    expect(await screen.findByRole("button", { name: "Turn on sale alerts" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Alert settings" }).getAttribute("href")).toBe(
      "/settings#alerts",
    );
    expect(
      screen.getByText("We'll email you when a sale is announced, and tell you in the app."),
    ).toBeTruthy();
  });

  it("turns alerts on at once, with no confirmation email, and then says they are on", async () => {
    loadAccountAlerts.mockResolvedValue({ state: "none", topics: [] });
    setAlertTopic.mockResolvedValue({ ok: true });
    render(<HomeAlertsSignedIn />);
    fireEvent.click(await screen.findByRole("button", { name: "Turn on sale alerts" }));
    await waitFor(() => expect(screen.getByText("You'll hear about new sales")).toBeTruthy());
    expect(setAlertTopic).toHaveBeenCalledWith("bid.new_sales", true);
    expect(success).toHaveBeenCalledWith("Sale alerts are on");
    expect(screen.queryByRole("button", { name: "Turn on sale alerts" })).toBeNull();
  });

  it("shows the on state straight away for someone already subscribed", async () => {
    loadAccountAlerts.mockResolvedValue({
      state: "confirmed",
      topics: [{ topic: "bid.new_sales", emailOn: true }],
    });
    render(<HomeAlertsSignedIn />);
    expect(await screen.findByText("You'll hear about new sales")).toBeTruthy();
    expect(screen.getByText(/Artists and searches are in Watching/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Manage alerts" }).getAttribute("href")).toBe(
      "/settings#alerts",
    );
    expect(screen.queryByRole("button", { name: "Turn on sale alerts" })).toBeNull();
  });

  it("keeps the button and says why when turning on fails", async () => {
    loadAccountAlerts.mockResolvedValue({ state: "none", topics: [] });
    setAlertTopic.mockResolvedValue({
      ok: false,
      error: "Verify your email address to get alerts.",
    });
    render(<HomeAlertsSignedIn />);
    fireEvent.click(await screen.findByRole("button", { name: "Turn on sale alerts" }));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("Verify your email address to get alerts."),
    );
    expect(screen.getByRole("button", { name: "Turn on sale alerts" })).toBeTruthy();
  });
});
