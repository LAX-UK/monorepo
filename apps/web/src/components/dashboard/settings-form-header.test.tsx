import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SettingsFormHeader", () => {
  it("hides title and description on mobile by default", () => {
    render(
      <SettingsFormHeader
        title="Profile"
        description="Update your display name and contact details."
      />,
    );

    const heading = screen.getByRole("heading", { level: 1, name: "Profile" });
    expect(heading.className).toMatch(/\bhidden\b/);
    expect(heading.className).toMatch(/\blg:block\b/);

    const description = screen.getByText("Update your display name and contact details.");
    expect(description.className).toMatch(/hidden lg:block/);
  });
});
