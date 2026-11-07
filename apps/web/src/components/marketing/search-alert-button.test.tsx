import { SearchAlertButton } from "@/components/marketing/search-alert-button";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const ensure = vi.fn();
const success = vi.fn();
const error = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/search",
}));
vi.mock("@/lib/marketing/search-alert", () => ({
  ensureSearchAlert: (...a: unknown[]) => ensure(...a),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (m: string) => success(m), error: (m: string) => error(m) },
}));

const base = { q: "harbour", returnHref: "/search?q=harbour&alert=1" };
const NAME = /get an alert for this search/i;

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/search?q=harbour&alert=1&view=grid");
});

describe("SearchAlertButton", () => {
  it("signed out: links to sign-in that returns with alert=1", () => {
    render(<SearchAlertButton {...base} isAuthenticated={false} saveOnArrival={false} />);
    const href = screen.getByRole("link", { name: NAME }).getAttribute("href") ?? "";
    const next = new URL(href, "http://x").searchParams.get("next");
    expect(next).toBe("/search?q=harbour&alert=1");
    expect(ensure).not.toHaveBeenCalled();
  });

  it("signed in, alert already saved: reads Alert set after a reload, with a way to manage alerts", () => {
    render(<SearchAlertButton {...base} isAuthenticated saveOnArrival={false} alertState="on" />);
    expect(screen.getByRole("status")).toHaveTextContent("Alert set");
    expect(screen.queryByRole("button", { name: NAME })).toBeNull();
    expect(screen.getByRole("link", { name: "Manage alerts" })).toHaveAttribute(
      "href",
      "/watching?tab=searches",
    );
    expect(ensure).not.toHaveBeenCalled();
  });

  it("signed in, search saved with email off: says so and offers the manage link", () => {
    render(
      <SearchAlertButton {...base} isAuthenticated saveOnArrival={false} alertState="email_off" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saved search · email off");
    expect(screen.queryByRole("button", { name: NAME })).toBeNull();
    expect(screen.getByRole("link", { name: "Manage alerts" })).toHaveAttribute(
      "href",
      "/watching?tab=searches",
    );
  });

  it("signed in: saves on click and shows Alert set", async () => {
    ensure.mockResolvedValue("created");
    render(<SearchAlertButton {...base} isAuthenticated saveOnArrival={false} />);
    fireEvent.click(screen.getByRole("button", { name: NAME }));
    expect(await screen.findByRole("status")).toHaveTextContent("Alert set");
    expect(ensure).toHaveBeenCalledWith("harbour", undefined);
    expect(success).toHaveBeenCalledWith(
      "Alert set. Matches arrive in your 08:00 email and in the app.",
    );
  });

  it("signed in: says so when the alert already exists", async () => {
    ensure.mockResolvedValue("existing");
    render(<SearchAlertButton {...base} isAuthenticated saveOnArrival={false} />);
    fireEvent.click(screen.getByRole("button", { name: NAME }));
    expect(await screen.findByRole("status")).toHaveTextContent("Alert set");
    expect(success).toHaveBeenCalledWith("You already have an alert for this search.");
  });

  it("signed in: a failed save reports it and lets them retry", async () => {
    ensure.mockResolvedValue("failed");
    render(<SearchAlertButton {...base} isAuthenticated saveOnArrival={false} />);
    fireEvent.click(screen.getByRole("button", { name: NAME }));
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: NAME })).toBeEnabled();
  });

  it("on arrival with alert=1: saves once and removes the param", async () => {
    ensure.mockResolvedValue("created");
    const { rerender } = render(<SearchAlertButton {...base} isAuthenticated saveOnArrival />);
    await waitFor(() => expect(replace).toHaveBeenCalled());
    rerender(<SearchAlertButton {...base} isAuthenticated saveOnArrival />);
    expect(ensure).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/search?q=harbour&view=grid", { scroll: false });
  });

  it("on arrival while signed out: does not save", () => {
    render(<SearchAlertButton {...base} isAuthenticated={false} saveOnArrival />);
    expect(ensure).not.toHaveBeenCalled();
  });
});
