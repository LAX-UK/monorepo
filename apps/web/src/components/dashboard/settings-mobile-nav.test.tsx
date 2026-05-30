import { SettingsMobileHeader } from "@/components/dashboard/settings-mobile-nav";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/components/dashboard/settings-inset-nav", () => ({
  SettingsInsetNav: () => <nav aria-label="Settings navigation">Settings nav</nav>,
}));

import { usePathname } from "next/navigation";

describe("SettingsMobileHeader", () => {
  it("renders inset nav on the settings hub", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/settings");

    render(<SettingsMobileHeader />);

    expect(screen.getByRole("navigation", { name: "Settings navigation" })).toBeInTheDocument();
  });

  it("renders back link and title on settings sub-pages", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/settings/profile");

    render(<SettingsMobileHeader />);

    expect(
      screen.queryByRole("navigation", { name: "Settings navigation" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All settings" })).toHaveAttribute(
      "href",
      "/dashboard/settings",
    );
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });
});
