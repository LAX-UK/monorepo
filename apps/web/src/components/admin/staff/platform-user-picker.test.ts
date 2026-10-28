import { describe, expect, it, vi } from "vitest";
import { userPickerOption } from "./platform-user-picker";

vi.mock("@/lib/actions/admin-users-browse", () => ({
  resolveAdminUserForPickerAction: vi.fn(),
  searchAdminUsersBrowseAction: vi.fn(),
}));

describe("userPickerOption", () => {
  it("offers an account by name with their email, never by ID", () => {
    expect(
      userPickerOption({ id: "u1", name: "Ada Marsh", email: "ada@example.com", role: "client" }),
    ).toEqual({ id: "u1", label: "Ada Marsh", description: "ada@example.com", meta: "Client" });
  });

  it("falls back to the email when there is no name, and names a staff role", () => {
    const option = userPickerOption({
      id: "u2",
      name: " ",
      email: "cat@lax.bid",
      role: "staff",
      staffRole: "cataloguer",
    });
    expect(option.label).toBe("cat@lax.bid");
    expect(option.meta).toBe("Cataloguer");
  });
});
