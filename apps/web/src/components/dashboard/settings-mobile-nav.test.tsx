import { SettingsMobileHeader } from "@/components/dashboard/settings-mobile-nav";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/dashboard/settings-inset-nav", () => ({
  SettingsInsetNav: ({ accountHref }: { accountHref: string | null }) => (
    <nav aria-label="Bid settings">{accountHref ?? "no account link"}</nav>
  ),
}));

describe("SettingsMobileHeader", () => {
  it("shows the settings list on every settings page", () => {
    render(<SettingsMobileHeader accountHref={null} />);
    expect(screen.getByRole("navigation", { name: "Bid settings" })).toBeInTheDocument();
  });

  it("passes the LAX Account link through", () => {
    render(<SettingsMobileHeader accountHref="https://account.example.test/account" />);
    expect(screen.getByText("https://account.example.test/account")).toBeInTheDocument();
  });
});
