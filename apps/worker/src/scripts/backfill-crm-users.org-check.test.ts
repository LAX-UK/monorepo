import { afterEach, describe, expect, it, vi } from "vitest";

const assertZohoCrmOrgEnvironment = vi.fn(async () => {});

vi.mock("../integrations/zoho/zoho-crm-org-check.js", () => ({
  assertZohoCrmOrgEnvironment,
}));

describe("backfill-crm-users org guard", () => {
  afterEach(() => {
    assertZohoCrmOrgEnvironment.mockClear();
  });

  it("calls assertZohoCrmOrgEnvironment before HTTP when sync mode is canary", async () => {
    const { runBackfillCrmUsersOrgGuard } = await import("./backfill-crm-users.org-check.js");
    await runBackfillCrmUsersOrgGuard({ performHttp: true, env: {} as never });
    expect(assertZohoCrmOrgEnvironment).toHaveBeenCalledOnce();
  });

  it("skips org check for dry-run backfill", async () => {
    const { runBackfillCrmUsersOrgGuard } = await import("./backfill-crm-users.org-check.js");
    await runBackfillCrmUsersOrgGuard({ performHttp: false, env: {} as never });
    expect(assertZohoCrmOrgEnvironment).not.toHaveBeenCalled();
  });
});
