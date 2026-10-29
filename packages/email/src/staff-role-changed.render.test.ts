import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

const BASE = {
  recipientFirstName: "Ada",
  staffName: "Grace Hopper",
  roleLabel: "Editor",
  productLabel: "LAX Admin",
  changedByName: "Alan Turing",
} as const;

describe("staff-role-changed email", () => {
  it("tells the person they were given a role, until when and by whom", async () => {
    const rendered = await renderEmail("staff-role-changed", {
      ...BASE,
      recipient: "person",
      change: "given",
      endsOnDisplay: "30 November 2026",
    });
    expect(rendered.subject).toBe("You have a new LAX Admin role: Editor");
    expect(rendered.text).toContain("you were given the Editor role on LAX Admin by Alan Turing");
    expect(rendered.text).toContain("30 November 2026");
    expect(rendered.html).not.toContain("/admin/staff/access");
  });

  it("tells an administrator whose role was removed and links to staff access", async () => {
    const rendered = await renderEmail("staff-role-changed", {
      ...BASE,
      recipient: "administrator",
      change: "removed",
      reason: "Moved to the gallery team",
      adminStaffAccessUrl: "https://lax.bid/admin/staff/access",
    });
    expect(rendered.subject).toBe("A LAX Admin role was removed: Grace Hopper");
    expect(rendered.text).toContain("Grace Hopper's Editor role on LAX Admin was removed");
    expect(rendered.text).toContain("Moved to the gallery team");
    expect(rendered.html).toContain("https://lax.bid/admin/staff/access");
  });
});
