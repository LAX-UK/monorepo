import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import DashboardRouteError from "@/components/dashboard/dashboard-route-error";
import { AccountsUnavailableError } from "@/lib/legal-entity/accounts-unavailable-error";
import { AccountsUnavailable } from "./accounts-unavailable";

describe("AccountsUnavailable", () => {
  beforeEach(() => refresh.mockClear());

  it("says the accounts could not be loaded, names no account, and offers to try again", () => {
    render(<AccountsUnavailable retry={{ kind: "refresh" }} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "We couldn't load your accounts" }),
    ).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "you're still using the account you chose",
    );
    expect(screen.queryByText(/personal/i)).toBeNull();
    expect(screen.getByRole("link", { name: "Contact us" }).getAttribute("href")).toMatch(
      /^mailto:/,
    );
  });

  it("re-renders the page on Try again", () => {
    const reset = vi.fn();
    render(<AccountsUnavailable retry={{ kind: "refresh", reset }} />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });

  it("goes back through the step that failed", () => {
    render(
      <AccountsUnavailable retry={{ kind: "link", href: "/switch-account?to=o&next=%2Fhome" }} />,
    );
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe(
      "/switch-account?to=o&next=%2Fhome",
    );
  });
});

describe("DashboardRouteError", () => {
  it("shows the accounts retry state for a page that could not read the accounts", () => {
    // In production the browser receives only the digest, without the message or class.
    const fromServer = Object.assign(new Error("hidden in production"), {
      digest: new AccountsUnavailableError("timeout").digest,
    });
    render(<DashboardRouteError error={fromServer} reset={() => {}} />);
    expect(screen.getByRole("heading", { name: "We couldn't load your accounts" })).toBeTruthy();
  });
});
