import { SettingsMobileHeader } from "@/components/dashboard/settings-mobile-nav";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/dashboard/settings-inset-nav", () => ({
  SettingsInsetNav: () => <nav aria-label="Bid settings" />,
}));

describe("SettingsMobileHeader", () => {
  it("shows the settings list on every settings page", () => {
    render(<SettingsMobileHeader />);
    expect(screen.getByRole("navigation", { name: "Bid settings" })).toBeInTheDocument();
  });
});
