import { describe, expect, it, vi } from "vitest";
import { hasStaffMarker } from "./staff-marker.js";

const readSubjectPolicyInputs = (markers: { kind: string }[]) =>
  vi.fn().mockResolvedValue({ markers, policies: [] });
const portsWith = (read: ReturnType<typeof vi.fn>) =>
  ({ twoFactorPolicyStore: { readSubjectPolicyInputs: read } }) as never;

describe("hasStaffMarker", () => {
  it("is true for a staff marker and false for none or an organisation marker", async () => {
    expect(await hasStaffMarker(portsWith(readSubjectPolicyInputs([{ kind: "staff" }])), "s")).toBe(
      true,
    );
    expect(
      await hasStaffMarker(portsWith(readSubjectPolicyInputs([{ kind: "org_member" }])), "s"),
    ).toBe(false);
    expect(await hasStaffMarker(portsWith(readSubjectPolicyInputs([])), "s")).toBe(false);
  });

  it("reads once and lets a failure through", async () => {
    const read = readSubjectPolicyInputs([]);
    await hasStaffMarker(portsWith(read), "s");
    expect(read).toHaveBeenCalledTimes(1);
    const failing = portsWith(vi.fn().mockRejectedValue(new Error("db")));
    await expect(hasStaffMarker(failing, "s")).rejects.toThrow("db");
  });
});
