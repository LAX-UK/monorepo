import type {
  AdminWorkItemSourceRow,
  IAdminWorkItemsReader,
} from "@auction/persistence/interfaces";
import { adminWorkItemHref } from "@auction/persistence/lib";
import { describe, expect, it, vi } from "vitest";
import { AdminWorkItemsService } from "./admin-work-items.service.js";

function row(
  partial: Partial<AdminWorkItemSourceRow> &
    Pick<AdminWorkItemSourceRow, "sourceId" | "kind" | "domain" | "title">,
): AdminWorkItemSourceRow {
  const now = new Date("2026-07-27T10:00:00.000Z");
  return {
    subtitle: null,
    href: adminWorkItemHref(partial.kind, {
      subjectId: partial.sourceId,
      paymentId: partial.sourceId,
      saleId: "sale-1",
    }),
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
    listBlockedCaptures: vi.fn().mockResolvedValue([]),
    listPendingReviewTasks: vi.fn().mockResolvedValue([]),
    listSubmissionReviews: vi.fn().mockResolvedValue([]),
    listConditionReports: vi.fn().mockResolvedValue([]),
    listLotFulfilment: vi.fn().mockResolvedValue([]),
    listPendingRegistrations: vi.fn().mockResolvedValue([]),
    listPendingTelephoneBookings: vi.fn().mockResolvedValue([]),
    listDraftLotsPastStart: vi.fn().mockResolvedValue([]),
    listUnsoldLotChoices: vi.fn().mockResolvedValue([]),
    listMarketingEnquiries: vi.fn().mockResolvedValue([]),
    listPurchaseProblems: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("AdminWorkItemsService", () => {
  it("does not show compliance review tasks to finance-only staff", async () => {
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
      actorStaffRoles: ["finance"],
      query: { limit: 25, assignment: "all", urgentOnly: false },
    });

    expect(listManualReviewPayments).toHaveBeenCalled();
    expect(result.items.some((item) => item.kind === "payment_manual_review")).toBe(true);
    expect(result.items.some((item) => item.kind === "aml_screening")).toBe(false);
  });

  it("offers finance Reinstate payment and Refund on money taken for a closed payment", async () => {
    const listBlockedCaptures = vi.fn().mockResolvedValue([
      row({
        sourceId: "pay-9",
        kind: "payment_capture_blocked",
        domain: "finance",
        title: "Payment taken on a closed payment",
      }),
    ]);
    const service = new AdminWorkItemsService(createReader({ listBlockedCaptures }));

    const asFinance = await service.listWorkItems({
      actorUserId: "u1",
      actorRole: "staff",
      actorStaffRoles: ["finance"],
      query: { limit: 25, assignment: "all", urgentOnly: false },
    });
    const item = asFinance.items.find((i) => i.kind === "payment_capture_blocked");
    expect(item?.id).toBe("payment_capture_blocked:pay-9");
    expect(item?.severity).toBe("critical");
    expect(item?.actions).toEqual(["reinstate_payment", "refund"]);

    const asClientServices = await service.listWorkItems({
      actorUserId: "u2",
      actorRole: "staff",
      actorStaffRoles: ["client_services"],
      query: { limit: 25, assignment: "all", urgentOnly: false },
    });
    expect(asClientServices.items.some((i) => i.kind === "payment_capture_blocked")).toBe(false);
  });

  it("does not show an entity review to finance-only staff, who cannot open the entity page", async () => {
    const reader = createReader({
      listPendingReviewTasks: vi.fn().mockResolvedValue([
        row({
          sourceId: "le-1",
          kind: "legal_entity_kyb",
          domain: "compliance",
          title: "Legal entity KYB needs review",
        }),
      ]),
    });
    const service = new AdminWorkItemsService(reader);
    const query = { limit: 25, assignment: "all", urgentOnly: false } as const;

    const financeOnly = await service.listWorkItems({
      actorUserId: "u1",
      actorRole: "staff",
      actorStaffRoles: ["finance"],
      query,
    });
    const compliance = await service.listWorkItems({
      actorUserId: "u2",
      actorRole: "staff",
      actorStaffRoles: ["compliance"],
      query,
    });

    expect(financeOnly.items).toHaveLength(0);
    expect(compliance.items.map((item) => item.kind)).toEqual(["legal_entity_kyb"]);
  });

  it("shows contact enquiries to client services and administrators only", async () => {
    const listMarketingEnquiries = vi.fn().mockResolvedValue([
      row({
        sourceId: "enq-1",
        kind: "marketing_enquiry",
        domain: "clients",
        title: "Contact enquiry — Press",
      }),
    ]);
    const service = new AdminWorkItemsService(createReader({ listMarketingEnquiries }));
    const query = { limit: 25, assignment: "all" as const, urgentOnly: false };

    for (const staffRoles of [["client_services"], ["administrator"]] as const) {
      const result = await service.listWorkItems({
        actorUserId: "u1",
        actorRole: "staff",
        actorStaffRoles: [...staffRoles],
        query,
      });
      expect(result.items.map((item) => item.id)).toEqual(["marketing_enquiry:enq-1"]);
      expect(result.items[0]?.dueAt).not.toBeNull();
    }

    listMarketingEnquiries.mockClear();
    for (const staffRoles of [["finance"], ["read_only"], ["cataloguer"]] as const) {
      const result = await service.listWorkItems({
        actorUserId: "u1",
        actorRole: "staff",
        actorStaffRoles: [...staffRoles],
        query,
      });
      expect(result.items.some((item) => item.kind === "marketing_enquiry")).toBe(false);
    }
    expect(listMarketingEnquiries).not.toHaveBeenCalled();
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
      actorStaffRoles: ["administrator"],
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
      actorStaffRoles: ["cataloguer"],
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
      actorStaffRoles: ["administrator"],
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
        actorStaffRoles: ["cataloguer"],
        query: { limit: 25, assignment: "all", urgentOnly: false },
      }),
    ).rejects.toThrow("database unavailable");
  });
});
