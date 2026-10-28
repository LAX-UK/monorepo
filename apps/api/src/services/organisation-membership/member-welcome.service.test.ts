import { describe, expect, it, vi } from "vitest";
import { MemberWelcomeService } from "./member-welcome.service.js";

const AT = new Date("2026-10-28T09:00:00Z");
const member = { userId: "u1", legalEntityId: "org1", role: "consignor" as const };

describe("MemberWelcomeService", () => {
  it("stores the dismissal on the membership, so it stays closed on every device", async () => {
    const dismiss = vi.fn(async () => true);
    const service = new MemberWelcomeService({ dismiss }, () => AT);
    expect((await service.dismiss(member)).isOk()).toBe(true);
    expect(dismiss).toHaveBeenCalledWith("u1", "org1", AT);
  });

  it("reports a membership that no longer exists", async () => {
    const service = new MemberWelcomeService({ dismiss: async () => false }, () => AT);
    expect((await service.dismiss(member))._unsafeUnwrapErr().code).toBe("not_found");
  });

  it("never changes it for LAX support viewing as the member", async () => {
    const dismiss = vi.fn(async () => true);
    const service = new MemberWelcomeService({ dismiss }, () => AT);
    const result = await service.dismiss({ ...member, isImpersonation: true });
    expect(result._unsafeUnwrapErr().code).toBe("forbidden");
    expect(dismiss).not.toHaveBeenCalled();
  });
});
