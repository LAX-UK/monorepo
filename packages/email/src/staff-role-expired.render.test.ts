import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

const BASE = {
  recipientFirstName: "Ada",
  staffName: "Grace Hopper",
  roleLabel: "Saleroom clerk",
  endedOnDisplay: "3 November 2026",
} as const;

describe("staff-role-expired email", () => {
  it("tells the person their role ended and who to ask, without an admin link", async () => {
    const rendered = await renderEmail("staff-role-expired", { ...BASE, recipient: "person" });
    expect(rendered.subject).toBe("Your Saleroom clerk role has ended");
    expect(rendered.text).toContain("your Saleroom clerk role on Bid ended on 3 November 2026");
    expect(rendered.text).toContain("Ask an administrator");
    expect(rendered.html).not.toContain("/admin/staff/access");
  });

  it("tells an administrator whose role ended and links to staff access", async () => {
    const rendered = await renderEmail("staff-role-expired", {
      ...BASE,
      recipient: "administrator",
      adminStaffAccessUrl: "https://lax.bid/admin/staff/access",
    });
    expect(rendered.subject).toBe("A staff role has ended: Grace Hopper");
    expect(rendered.text).toContain("Grace Hopper");
    expect(rendered.text).toContain("Saleroom clerk");
    expect(rendered.html).toContain("https://lax.bid/admin/staff/access");
  });
});
