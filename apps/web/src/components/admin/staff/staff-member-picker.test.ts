import { SALEROOM_ACCESS } from "@/lib/navigation/staff-nav-access";
import { describe, expect, it, vi } from "vitest";
import { staffPickerOptions } from "./staff-member-picker";

vi.mock("@/lib/actions/admin-users-browse", () => ({
  resolveAdminUserForPickerAction: vi.fn(),
  searchAdminUsersBrowseAction: vi.fn(),
}));

const rows = [
  {
    id: "u1",
    name: "Hannah Clerk",
    email: "hannah@lax.bid",
    role: "staff",
    staffRole: "sales_manager",
    staffRoles: ["sales_manager"],
  },
  {
    id: "u2",
    name: "Cat Logue",
    email: "cat@lax.bid",
    role: "staff",
    staffRole: "cataloguer",
    staffRoles: ["cataloguer"],
  },
  {
    id: "u3",
    name: "",
    email: "viewer@lax.bid",
    role: "staff",
    staffRole: "read_only",
    staffRoles: ["read_only"],
  },
];

describe("staffPickerOptions", () => {
  it("offers staff by name with their email and role, never by ID", () => {
    const [first] = staffPickerOptions(rows);
    expect(first).toMatchObject({ id: "u1", label: "Hannah Clerk", description: "hannah@lax.bid" });
    expect(first?.meta).toBeTruthy();
    expect(staffPickerOptions(rows)[2]?.label).toBe("viewer@lax.bid");
  });

  it("leaves out staff whose role cannot take telephone bids", () => {
    const ids = staffPickerOptions(rows, SALEROOM_ACCESS).map((option) => option.id);
    expect(ids).toContain("u1");
    expect(ids).not.toContain("u3");
  });
});
