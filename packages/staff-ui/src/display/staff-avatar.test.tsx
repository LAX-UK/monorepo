import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StaffAvatar } from "./staff-avatar.js";

describe("StaffAvatar", () => {
  it("shows two initials, hidden from screen readers", () => {
    const { container } = render(<StaffAvatar name="Clara Mendes" />);
    const avatar = container.querySelector('[data-slot="avatar"]');
    expect(avatar?.textContent).toBe("CM");
    expect(avatar?.getAttribute("aria-hidden")).toBe("true");
    expect(avatar?.className).toContain("text-staff-xs");
  });

  it("draws nobody as an empty dashed ring", () => {
    const { container } = render(<StaffAvatar empty />);
    const avatar = container.querySelector('[data-slot="avatar"]');
    expect(avatar?.textContent).toBe("");
    expect(avatar?.className).toContain("border-dashed");
  });
});
