import { PlatformRoleBadge } from "@/components/admin/platform-role-badge";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("PlatformRoleBadge", () => {
  it("renders visible label and accessible name", () => {
    render(<PlatformRoleBadge targetRole="staff" targetStaffRole="catalogue_manager" />);
    expect(screen.getByText("Catalogue manager")).toBeInTheDocument();
    expect(screen.getByLabelText("Staff — Catalogue manager")).toBeInTheDocument();
  });

  it("applies categorical palette data attribute", () => {
    render(<PlatformRoleBadge targetRole="client" targetStaffRole={null} />);
    const badge = screen.getByLabelText("Client");
    expect(badge).toHaveAttribute("data-platform-role", "client");
    expect(badge.className).toMatch(/platform-role-badge/);
  });
});
