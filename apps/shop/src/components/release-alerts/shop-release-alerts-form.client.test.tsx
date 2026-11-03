/** @vitest-environment jsdom */
import { stopReleaseAlerts, subscribeReleaseAlerts } from "@/app/actions/release-alerts.actions";
import { ShopReleaseAlertsForm } from "@/components/release-alerts/shop-release-alerts-form.client";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/release-alerts.actions", () => ({
  subscribeReleaseAlerts: vi.fn(),
  stopReleaseAlerts: vi.fn(),
}));

const subscribeMock = vi.mocked(subscribeReleaseAlerts);
const stopMock = vi.mocked(stopReleaseAlerts);
const GET = { name: "Get release alerts" };

describe("ShopReleaseAlertsForm", () => {
  afterEach(() => {
    cleanup();
    subscribeMock.mockReset();
    stopMock.mockReset();
  });

  it("does not move focus when the page loads", () => {
    render(<ShopReleaseAlertsForm viewer={{ kind: "guest" }} source="shop_home" />);
    expect(document.activeElement).toBe(document.body);
  });

  it("checks the address before sending and summarises what to fix", () => {
    render(<ShopReleaseAlertsForm viewer={{ kind: "guest" }} source="shop_home" />);
    fireEvent.click(screen.getByRole("button", GET));
    const input = screen.getByLabelText("Email address");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain("Enter your email address");
    fireEvent.change(input, { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", GET));
    expect(screen.getByRole("alert").textContent).toContain("correct format");
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("asks a visitor to confirm by email and announces it politely", async () => {
    subscribeMock.mockResolvedValueOnce({ ok: true, status: "check_email" });
    render(<ShopReleaseAlertsForm viewer={{ kind: "guest" }} source="shop_home" />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: " grace@example.com " },
    });
    fireEvent.click(screen.getByRole("button", GET));
    await waitFor(() => expect(screen.getByText("Check your email")).toBeTruthy());
    expect(subscribeMock).toHaveBeenCalledWith({ source: "shop_home", email: "grace@example.com" });
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("grace@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Use a different address" }));
    expect(screen.getByLabelText("Email address")).toBeTruthy();
  });

  it("shows the server's rejection of an address at the field", async () => {
    subscribeMock.mockResolvedValueOnce({
      ok: false,
      kind: "invalid",
      message: "Enter an email address in the correct format, like name@example.com",
    });
    render(<ShopReleaseAlertsForm viewer={{ kind: "guest" }} source="shop_home" />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "grace@example.com" },
    });
    fireEvent.click(screen.getByRole("button", GET));
    await waitFor(() =>
      expect(screen.getByLabelText("Email address").getAttribute("aria-invalid")).toBe("true"),
    );
  });

  it("says when there have been too many requests, and keeps the form", async () => {
    subscribeMock.mockResolvedValueOnce({
      ok: false,
      kind: "limited",
      message: "That is a lot of requests from here. Wait a few minutes, then try again.",
    });
    render(<ShopReleaseAlertsForm viewer={{ kind: "guest" }} source="shop_home" />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "grace@example.com" },
    });
    fireEvent.click(screen.getByRole("button", GET));
    await waitFor(() => expect(screen.getByText("Too many requests")).toBeTruthy());
    expect(screen.getByLabelText("Email address")).toBeTruthy();
  });

  it("passes the honeypot through untouched", async () => {
    subscribeMock.mockResolvedValueOnce({ ok: true, status: "check_email" });
    const { container } = render(
      <ShopReleaseAlertsForm viewer={{ kind: "guest" }} source="shop_home" />,
    );
    const trap = container.querySelector<HTMLInputElement>('input[name="website"]');
    expect(trap?.getAttribute("tabindex")).toBe("-1");
    fireEvent.change(trap as HTMLInputElement, { target: { value: "https://spam.example" } });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "bot@example.com" },
    });
    fireEvent.click(screen.getByRole("button", GET));
    await waitFor(() => expect(subscribeMock).toHaveBeenCalled());
    expect(subscribeMock).toHaveBeenCalledWith(
      expect.objectContaining({ website: "https://spam.example" }),
    );
  });

  it("subscribes a signed-in shopper with one button, then offers to stop", async () => {
    subscribeMock.mockResolvedValueOnce({ ok: true, status: "subscribed" });
    stopMock.mockResolvedValueOnce({ ok: true });
    render(
      <ShopReleaseAlertsForm
        viewer={{ kind: "account", email: "robert@example.test", subscribed: false }}
        source="shop_home"
      />,
    );
    expect(screen.getByText("robert@example.test")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", GET));
    await waitFor(() => expect(screen.getByText("Done")).toBeTruthy());
    expect(subscribeMock).toHaveBeenCalledWith({ source: "shop_home" });
    fireEvent.click(await screen.findByRole("button", { name: "Stop alerts" }));
    await waitFor(() => expect(screen.getByText(/Release alerts stopped/)).toBeTruthy());
  });

  it("shows a shopper who is already subscribed that they are on the list", () => {
    render(
      <ShopReleaseAlertsForm
        viewer={{ kind: "account", email: "robert@example.test", subscribed: true }}
        source="shop_home"
      />,
    );
    expect(screen.getByText("You’re on the list")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop alerts" })).toBeTruthy();
  });
});
