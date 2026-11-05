// @vitest-environment jsdom
import type { AlertSectionVm } from "@/server/domain/account-alerts.vm";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setAlertTopicAction = vi.fn();
vi.mock("@/server/application/alert-preference-actions.server", () => ({ setAlertTopicAction }));

const { AlertPreferences } = await import("./alert-preferences.client");

const sections: AlertSectionVm[] = [
  {
    id: "bid",
    label: "LAX Bid",
    state: "ready",
    unavailableMessage: "We couldn't load LAX Bid alerts. Try again.",
    rows: [
      {
        topic: "bid.new_sales",
        title: "New sales",
        description: "When LAX Bid announces a sale",
        emailOn: true,
      },
      {
        topic: "bid.artists",
        title: "Artists you follow",
        description: "New lots by artists you follow",
        emailOn: false,
      },
    ],
    note: {
      text: "App alerts, quiet hours, artists and searches are in",
      link: { href: "https://bid.test/settings/notifications", label: "LAX Bid settings" },
      end: ".",
    },
  },
  {
    id: "shop",
    label: "LAX Shop",
    state: "unavailable",
    unavailableMessage: "We couldn't load LAX Shop alerts. Try again.",
    rows: [],
    note: null,
  },
];

function renderIt(disabled = false) {
  return render(
    <AlertPreferences sections={sections} disabled={disabled} returnTo="/account/alerts" />,
  );
}

const on = (name: string) => screen.getByRole("switch", { name }).getAttribute("aria-checked");

describe("alert preferences", () => {
  beforeEach(() => setAlertTopicAction.mockReset());
  afterEach(cleanup);

  it("shows each product's switches as they are, and a product that failed with a retry", () => {
    renderIt();
    expect(on("New sales")).toBe("true");
    expect(on("Artists you follow")).toBe("false");
    expect(document.body.textContent).toContain("load LAX Shop alerts. Try again.");
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe(
      "/account/alerts",
    );
    expect(screen.getByRole("link", { name: "LAX Bid settings" }).getAttribute("href")).toBe(
      "https://bid.test/settings/notifications",
    );
  });

  it("keeps the new position once the change is saved and says so", async () => {
    setAlertTopicAction.mockResolvedValue({ status: "ok", message: "All changes saved" });
    renderIt();
    fireEvent.click(screen.getByRole("switch", { name: "Artists you follow" }));
    expect(setAlertTopicAction).toHaveBeenCalledWith({ topic: "bid.artists", on: true });
    await waitFor(() =>
      expect(within(document.body).getAllByText("All changes saved").length).toBeGreaterThan(0),
    );
    expect(on("Artists you follow")).toBe("true");
  });

  it("puts a switch back and says why when the change is refused", async () => {
    setAlertTopicAction.mockResolvedValue({
      status: "error",
      message: "Verify your email address to switch alerts on.",
    });
    renderIt();
    fireEvent.click(screen.getByRole("switch", { name: "Artists you follow" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Verify your email"),
    );
    expect(on("Artists you follow")).toBe("false");
  });

  it("puts a switch back when the product cannot be reached at all", async () => {
    // A server action whose request itself fails rejects; the component answers it as an error.
    setAlertTopicAction.mockImplementation(() => ({
      catch: (onRejected: () => unknown) => Promise.resolve(onRejected()),
    }));
    renderIt();
    fireEvent.click(screen.getByRole("switch", { name: "New sales" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("couldn't save"));
    expect(on("New sales")).toBe("true");
  });

  it("cannot be changed until the address is verified", () => {
    renderIt(true);
    expect((screen.getByRole("switch", { name: "New sales" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("switch", { name: "New sales" }));
    expect(setAlertTopicAction).not.toHaveBeenCalled();
  });
});
