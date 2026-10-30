import { AuthzError } from "@auction/exports/providers";
import { resolveIncludePii } from "@auction/exports/providers";
import { describe, expect, it, vi } from "vitest";
import { type IExportProviderDeps, createExportProviders } from "./registry.js";

function baseDeps(overrides: Partial<IExportProviderDeps> = {}): IExportProviderDeps {
  return {
    lotRepo: {
      countMatching: vi.fn().mockResolvedValue(0),
      list: vi.fn().mockResolvedValue([]),
    } as unknown as IExportProviderDeps["lotRepo"],
    saleRepo: {
      countMatching: vi.fn().mockResolvedValue(0),
      list: vi.fn().mockResolvedValue([]),
    } as unknown as IExportProviderDeps["saleRepo"],
    submissionRepo: {
      countAdmin: vi.fn().mockResolvedValue(0),
      listForAdmin: vi.fn().mockResolvedValue([]),
    } as unknown as IExportProviderDeps["submissionRepo"],
    adminUserReader: {
      list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    } as unknown as IExportProviderDeps["adminUserReader"],
    paymentRepo: {
      countForAdminTable: vi.fn().mockResolvedValue(0),
      listForAdminTable: vi.fn().mockResolvedValue([]),
    },
    domainEvents: {
      countForExport: vi.fn().mockResolvedValue(0),
      listRedacted: vi.fn().mockResolvedValue([]),
    } as unknown as IExportProviderDeps["domainEvents"],
    payoutRepo: {
      countMatching: vi.fn().mockResolvedValue(0),
      list: vi.fn().mockResolvedValue([]),
    } as unknown as IExportProviderDeps["payoutRepo"],
    legalEntityRepo: {
      findActiveMembership: vi.fn().mockResolvedValue(null),
    } as unknown as IExportProviderDeps["legalEntityRepo"],
    ...overrides,
  };
}

describe("export auth helpers", () => {
  it("blocks includePii without audit.read_pii", () => {
    expect(() =>
      resolveIncludePii(
        { userId: "u1", userRole: "staff", userStaffRoles: ["sales_manager"] },
        true,
      ),
    ).toThrow(AuthzError);
  });

  it("allows includePii for administrator staff", () => {
    expect(
      resolveIncludePii(
        { userId: "u1", userRole: "staff", userStaffRoles: ["administrator"] },
        true,
      ),
    ).toBe(true);
  });
});

describe("createExportProviders", () => {
  it("allows finance to export payments", () => {
    const deps = baseDeps();
    const providers = createExportProviders(deps);
    const payments = providers.get("payments");
    expect(() =>
      payments?.authorize({ userId: "u1", userRole: "staff", userStaffRoles: ["finance"] }, {}),
    ).not.toThrow();
  });

  it("rejects client payout export without legalEntityId", async () => {
    const deps = baseDeps();
    const providers = createExportProviders(deps);
    const payouts = providers.get("payouts");
    await expect(
      payouts?.authorize({ userId: "u1", userRole: "client", userStaffRoles: [] }, {}),
    ).rejects.toThrow(AuthzError);
  });

  it("requires membership for client payout export", async () => {
    const findActiveMembership = vi.fn().mockResolvedValue(null);
    const deps = baseDeps({
      legalEntityRepo: {
        findActiveMembership,
      } as unknown as IExportProviderDeps["legalEntityRepo"],
    });
    const providers = createExportProviders(deps);
    const payouts = providers.get("payouts");
    await expect(
      payouts?.authorize(
        { userId: "u1", userRole: "client", userStaffRoles: [] },
        { legalEntityId: "11111111-1111-4111-8111-111111111111" },
      ),
    ).rejects.toThrow(AuthzError);
    expect(findActiveMembership).toHaveBeenCalled();
  });

  it("exports payments with every filter the list applies", async () => {
    const countForAdminTable = vi.fn().mockResolvedValue(3);
    const deps = baseDeps({ paymentRepo: { countForAdminTable, listForAdminTable: vi.fn() } });
    const providers = createExportProviders(deps);
    const payments = providers.get("payments");
    await payments?.estimateCount(
      { userId: "u1", userRole: "staff", userStaffRoles: ["finance"] },
      { status: "captured", q: " golden ", fulfilment: "in_transit,delivered", xero: "linked" },
    );
    expect(countForAdminTable).toHaveBeenCalledWith({
      status: "captured",
      q: "golden",
      fulfilmentStatuses: ["in_transit", "delivered"],
      xeroInvoice: "linked",
    });
  });

  it("drops payment filter values the list never sends", async () => {
    const countForAdminTable = vi.fn().mockResolvedValue(3);
    const deps = baseDeps({ paymentRepo: { countForAdminTable, listForAdminTable: vi.fn() } });
    const payments = createExportProviders(deps).get("payments");
    await payments?.estimateCount(
      { userId: "u1", userRole: "staff", userStaffRoles: ["finance"] },
      { status: "everything", xero: "maybe", fulfilment: "" },
    );
    expect(countForAdminTable).toHaveBeenCalledWith({});
  });

  it("maps manualReview filter to the manual review status", async () => {
    const countForAdminTable = vi.fn().mockResolvedValue(1);
    const deps = baseDeps({ paymentRepo: { countForAdminTable, listForAdminTable: vi.fn() } });
    const providers = createExportProviders(deps);
    const payments = providers.get("payments");
    await payments?.estimateCount(
      { userId: "u1", userRole: "staff", userStaffRoles: ["finance"] },
      { manualReview: true },
    );
    expect(countForAdminTable).toHaveBeenCalledWith({ status: "requires_manual_review" });
  });

  it("allows catalogue staff to export scoped domain events", () => {
    const deps = baseDeps();
    const providers = createExportProviders(deps);
    const domainEvents = providers.get("domain-events");
    expect(() =>
      domainEvents?.authorize(
        { userId: "u1", userRole: "staff", userStaffRoles: ["cataloguer"] },
        { aggregateType: "lot", aggregateId: "lot-1" },
      ),
    ).not.toThrow();
  });

  it("requires platform admin for unscoped domain events export", () => {
    const deps = baseDeps();
    const providers = createExportProviders(deps);
    const domainEvents = providers.get("domain-events");
    expect(() =>
      domainEvents?.authorize({ userId: "u1", userRole: "staff", userStaffRoles: ["finance"] }, {}),
    ).toThrow(AuthzError);
  });

  it("exports payouts in the status the staff list is filtered to", async () => {
    const countMatching = vi.fn().mockResolvedValue(4);
    const list = vi.fn().mockResolvedValue([]);
    const deps = baseDeps({
      payoutRepo: { countMatching, list } as unknown as IExportProviderDeps["payoutRepo"],
    });
    const payouts = createExportProviders(deps).get("payouts");
    const ctx = { userId: "u1", userRole: "staff", userStaffRoles: ["finance"] } as const;
    const filters = {
      status: "failed" as const,
      legalEntityId: "11111111-1111-4111-8111-111111111111",
    };

    await payouts?.estimateCount(ctx, filters);
    for await (const _row of payouts?.streamRows(ctx, filters) ?? []) {
      // No rows; the scope passed to the repository is what is under test.
    }

    expect(countMatching).toHaveBeenCalledWith(filters);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ ...filters, offset: 0 }));
  });

  it("keeps a client's payout export to their own entity, in the status they chose", async () => {
    const countMatching = vi.fn().mockResolvedValue(1);
    const deps = baseDeps({
      payoutRepo: { countMatching, list: vi.fn() } as unknown as IExportProviderDeps["payoutRepo"],
      legalEntityRepo: {
        findActiveMembership: vi.fn().mockResolvedValue({ id: "m1", role: "finance" }),
      } as unknown as IExportProviderDeps["legalEntityRepo"],
    });
    const payouts = createExportProviders(deps).get("payouts");

    await payouts?.estimateCount(
      { userId: "u1", userRole: "client", userStaffRoles: [] },
      { legalEntityId: "11111111-1111-4111-8111-111111111111", status: "paid" },
    );

    expect(countMatching).toHaveBeenCalledWith({
      legalEntityId: "11111111-1111-4111-8111-111111111111",
      status: "paid",
    });
  });

  it("includes full payout columns in export rows", async () => {
    const list = vi.fn().mockResolvedValue([
      {
        id: "p1",
        legalEntityId: "le1",
        periodStart: new Date("2026-01-01T00:00:00.000Z"),
        periodEnd: new Date("2026-01-07T00:00:00.000Z"),
        grossAmount: "100",
        platformFee: "10",
        stripeFee: "2",
        netAmount: "88",
        currency: "GBP",
        status: "paid",
      },
    ]);
    const deps = baseDeps({
      payoutRepo: {
        countMatching: vi.fn().mockResolvedValue(1),
        list,
      } as unknown as IExportProviderDeps["payoutRepo"],
      legalEntityRepo: {
        findActiveMembership: vi.fn().mockResolvedValue({ id: "m1", role: "finance" }),
      } as unknown as IExportProviderDeps["legalEntityRepo"],
    });
    const providers = createExportProviders(deps);
    const payouts = providers.get("payouts");
    expect(payouts).toBeDefined();
    if (!payouts) return;
    const rows: Array<Record<string, string>> = [];
    for await (const row of payouts.streamRows(
      { userId: "u1", userRole: "client", userStaffRoles: [] },
      { legalEntityId: "11111111-1111-4111-8111-111111111111" },
    )) {
      rows.push(row as Record<string, string>);
    }
    expect(rows[0]).toMatchObject({
      id: "p1",
      grossAmount: "100",
      platformFee: "10",
      stripeFee: "2",
      netAmount: "88",
      currency: "GBP",
      status: "paid",
    });
  });
});
