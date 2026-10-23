import { describe, expect, it, vi } from "vitest";
import { switchSellingContext } from "./switch-selling-context";

describe("switchSellingContext", () => {
  it("reports a switch and passes the chosen account through", async () => {
    const switchAccount = vi.fn().mockResolvedValue({ ok: true });
    await expect(switchSellingContext("org-1", switchAccount)).resolves.toEqual({
      kind: "switched",
    });
    expect(switchAccount).toHaveBeenCalledWith("org-1");
  });

  it.each([
    ["not_a_member", "Cannot switch"],
    ["unauthenticated", "Session expired"],
    ["unknown", "Could not switch"],
  ] as const)("explains a %s refusal", async (error, title) => {
    const outcome = await switchSellingContext("org-1", async () => ({ ok: false, error }));
    expect(outcome).toMatchObject({ kind: "refused", title });
  });

  it("turns a thrown error into a refusal instead of leaving the picker waiting", async () => {
    const outcome = await switchSellingContext("org-1", async () => {
      throw new Error("network");
    });
    expect(outcome).toMatchObject({ kind: "refused", title: "Could not switch" });
  });
});
