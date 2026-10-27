import { describe, expect, it, vi } from "vitest";
import { switchAccount } from "./switch-account";

describe("switchAccount", () => {
  it("reports a switch and passes the chosen account through", async () => {
    const requestSwitch = vi.fn().mockResolvedValue({ ok: true });
    await expect(switchAccount("org-1", requestSwitch)).resolves.toEqual({
      kind: "switched",
    });
    expect(requestSwitch).toHaveBeenCalledWith("org-1");
  });

  it.each([
    ["not_a_member", "Cannot switch"],
    ["unauthenticated", "Session expired"],
    ["unknown", "Could not switch"],
  ] as const)("explains a %s refusal", async (error, title) => {
    const outcome = await switchAccount("org-1", async () => ({ ok: false, error }));
    expect(outcome).toMatchObject({ kind: "refused", title });
  });

  it("turns a thrown error into a refusal instead of leaving the picker waiting", async () => {
    const outcome = await switchAccount("org-1", async () => {
      throw new Error("network");
    });
    expect(outcome).toMatchObject({ kind: "refused", title: "Could not switch" });
  });
});
