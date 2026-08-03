import type {
  AdminWorkItemSourceRow,
  IAdminWorkItemsReader,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { AdminWorkItemsService } from "./admin-work-items.service.js";

function row(
  partial: Partial<AdminWorkItemSourceRow> &
    Pick<AdminWorkItemSourceRow, "sourceId" | "kind" | "domain" | "title">,
): AdminWorkItemSourceRow {
  const now = new Date("2026-07-27T10:00:00.000Z");
  return {
    subtitle: null,
    href: "/admin/test",
    saleId: null,
    createdAt: now,
    sourceUpdatedAt: now,
    assignedToUserId: null,
    ...partial,
  };
}

function createReader(overrides: Partial<IAdminWorkItemsReader> = {}): IAdminWorkItemsReader {
  return {
    listManualReviewPayments: vi.fn().mockResolvedValue([]),
    listPendingReviewTasks: vi.fn().mockResolvedValue([]),
    listSubmissionReviews: vi.fn().mockResolvedValue([]),
    listConditionReports: vi.fn().mockResolvedValue([]),
    listLotFulfilment: vi.fn().mockResolvedValue([]),
    listPendingRegistrations: vi.fn().mockResolvedValue([]),
    listPendingTelephoneBookings: vi.fn().mockResolvedValue([]),
    listDraftLotsPastStart: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("AdminWorkItemsService", () => {
  it("does not fetch compliance review tasks for finance-only staff", async () => {
    const listPendingReviewTasks = vi.fn().mockResolvedValue([
      row({
        sourceId: "task-1",
        kind: "aml_screening",
        domain: "compliance",
        title: "AML screening needs review",
      }),
    ]);
    const listManualReviewPayments = vi.fn().mockResolvedValue([
      row({
        sourceId: "pay-1",
        kind: "payment_manual_review",
        domain: "finance",
        title: "Payment manual review",
      }),
    ]);
    const reader = createReader({
      listPendingReviewTasks,
      listManualReviewPayments,
    });
    const service = new AdminWorkItemsService(reader);

    const result = await service.listWorkItems({
      actorUserId: "u1",
      actorRole: "staff",
      actorStaffRole: "finance_ops",
      query: { limit: 25, assignment: "all", urgentOnly: false },
    });

    expect(listManualReviewPayments).toHaveBeenCalled();
    expect(listPendingReviewTasks).not.toHaveBeenCalled();
    expect(result.items.some((item) => item.kind === "payment_manual_review")).toBe(true);
    expect(result.items.some((item) => item.kind === "aml_screening")).toBe(false);
  });

  it("ranks critical finance items before medium catalogue items", async () => {
    const reader = createReader({
      listManualReviewPayments: vi.fn().mockResolvedValue([
        row({
          sourceId: "pay-1",
          kind: "payment_manual_review",
          domain: "finance",
          title: "Payment manual review",
          sourceUpdatedAt: new Date("2026-07-24T10:00:00.000Z"),
        }),
      ]),
      listSubmissionReviews: vi.fn().mockResolvedValue([
        row({
          sourceId: "sub-1",
          kind: "submission_review",
          domain: "catalogue",
          title: "Submission",
          sourceUpdatedAt: new Date("2026-07-26T10:00:00.000Z"),
        }),
      ]),
    });
    const service = new AdminWorkItemsService(reader);

    const result = await service.listWorkItems({
      actorUserId: "u1",
      actorRole: "staff",
      actorStaffRole: "super_admin",
      query: { limit: 25, assignment: "all", urgentOnly: false },
    });

    expect(result.items[0]?.kind).toBe("payment_manual_review");
    expect(result.items[0]?.actions).toContain("capture");
  });

  it("filters assignment=mine to assigned rows only", async () => {
    const reader = createReader({
      listSubmissionReviews: vi.fn().mockResolvedValue([
        row({
          sourceId: "sub-1",
          kind: "submission_review",
          domain: "catalogue",
          title: "Mine",
          assignedToUserId: "u1",
        }),
        row({
          sourceId: "sub-2",
          kind: "submission_review",
          domain: "catalogue",
          title: "Unassigned",
          assignedToUserId: null,
        }),
      ]),
    });
    const service = new AdminWorkItemsService(reader);

    const result = await service.listWorkItems({
      actorUserId: "u1",
      actorRole: "staff",
      actorStaffRole: "catalogue_manager",
      query: { limit: 25, assignment: "mine", urgentOnly: false },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("Mine");
    expect(reader.listSubmissionReviews).toHaveBeenCalledWith({
      limit: 50,
      assignment: "mine",
      actorUserId: "u1",
    });
    expect(reader.listManualReviewPayments).not.toHaveBeenCalled();
  });

  it("does not advertise actions that require contextual review or shipping input", async () => {
    const reader = createReader({
      listPendingReviewTasks: vi.fn().mockResolvedValue([
        row({
          sourceId: "aml-1",
          kind: "aml_screening",
          domain: "compliance",
          title: "AML review",
        }),
        row({
          sourceId: "kyb-1",
          kind: "legal_entity_kyb",
          domain: "clients",
          title: "KYB review",
        }),
        row({
          sourceId: "withdrawal-1",
          kind: "lot_withdrawal",
          domain: "catalogue",
          title: "Withdrawal review",
        }),
      ]),
      listLotFulfilment: vi.fn().mockResolvedValue([
        row({
          sourceId: "lot-1",
          kind: "lot_fulfilment",
          domain: "fulfilment",
          title: "Released lot",
          meta: { fulfilmentStatus: "released" },
        }),
      ]),
    });
    const service = new AdminWorkItemsService(reader);

    const result = await service.listWorkItems({
      actorUserId: "u1",
      actorRole: "staff",
      actorStaffRole: "super_admin",
      query: { limit: 25, assignment: "all", urgentOnly: false },
    });

    expect(result.items.find((item) => item.kind === "aml_screening")?.actions).toEqual([]);
    expect(result.items.find((item) => item.kind === "legal_entity_kyb")?.actions).toEqual([]);
    expect(result.items.find((item) => item.kind === "lot_withdrawal")?.actions).toEqual([]);
    expect(result.items.find((item) => item.kind === "lot_fulfilment")?.actions).toEqual([
      "ready_for_collection",
    ]);
  });

  it("propagates a source failure instead of presenting a partial inbox", async () => {
    const service = new AdminWorkItemsService(
      createReader({
        listSubmissionReviews: vi.fn().mockRejectedValue(new Error("database unavailable")),
      }),
    );

    await expect(
      service.listWorkItems({
        actorUserId: "u1",
        actorRole: "staff",
        actorStaffRole: "catalogue_manager",
        query: { limit: 25, assignment: "all", urgentOnly: false },
      }),
    ).rejects.toThrow("database unavailable");
  });
});
