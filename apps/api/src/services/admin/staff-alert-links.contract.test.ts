import type { AdminWorkItemSourceKind } from "@auction/persistence/interfaces";
import {
  ATTENTION_KIND_ACCESS,
  type AdminWorkItemLinkIds,
  adminWorkItemHref,
  attentionItemsForViewer,
  composeAttentionItems,
} from "@auction/persistence/lib";
import {
  adminRoutes,
  canOpenAdminLink,
  resolveAdminRoute,
  userHasAccessTo,
  userStaffRoles,
} from "@auction/types";
import { describe, expect, it } from "vitest";
import { AdminSaleReadinessService } from "./admin-sale-readiness.service.js";
import { WORK_ITEM_KIND_ACCESS } from "./admin-work-items.service.js";

/**
 * Contract for every link a staff alert produces. A kind added without a sample here fails to
 * compile; a kind whose link does not resolve to a known admin page, or that sends someone who
 * can see the alert to a page they cannot open, fails the tests below.
 */

const WORK_ITEM_SAMPLES: Record<AdminWorkItemSourceKind, AdminWorkItemLinkIds> = {
  payment_manual_review: { subjectId: "pay-1" },
  payment_money_unapplied: { paymentId: "pay-1" },
  aml_screening: { subjectId: "scr-1" },
  sof_case: { subjectId: "sof-1" },
  submission_review: { subjectId: "sub-1" },
  condition_report: { subjectId: "cr-1" },
  lot_fulfilment: { subjectId: "lot-1" },
  sale_registration: { saleId: "sale-1" },
  telephone_booking: { saleId: "sale-1", status: "requested" },
  legal_entity_kyb: { subjectId: "le-1" },
  lot_withdrawal: { subjectId: "lot-1" },
  lot_draft_past_start: { subjectId: "lot-1" },
  unsold_lot_choice: { subjectId: "sub-1" },
  unsold_choice_follow_up: { subjectId: "sub-1" },
  unsold_choice_lapsed: { subjectId: "sub-1" },
  marketing_enquiry: { subjectId: "enq-1" },
  purchase_problem: { subjectId: "pp-1" },
  payment_capture_blocked: { paymentId: "pay-1" },
  payment_overdue: { subjectId: "lot-1" },
  deletion_hold: { subjectId: "subject-1" },
  register_lot_mismatch: { subjectId: "lot-1" },
  reoffer_no_reply: { subjectId: "lot-1" },
  reoffer_ready: { subjectId: "lot-1" },
  reoffer_decision: { subjectId: "lot-1" },
  reoffer_accepted: { subjectId: "lot-1" },
};

const KINDS = Object.keys(WORK_ITEM_SAMPLES) as AdminWorkItemSourceKind[];

/** Each Bid staff role on its own, and the two ways a person holds none. */
const VIEWERS = userStaffRoles.map((role) => ({ label: role, staffRoles: [role] as const }));

describe("work item links", () => {
  it.each(KINDS)("%s resolves to a known admin page", (kind) => {
    const href = adminWorkItemHref(kind, WORK_ITEM_SAMPLES[kind]);
    expect(resolveAdminRoute(href), href).toBeDefined();
  });

  it.each(KINDS)("%s page asks for no more than the kind needs to be seen", (kind) => {
    const href = adminWorkItemHref(kind, WORK_ITEM_SAMPLES[kind]);
    const entry = resolveAdminRoute(href);
    for (const viewer of VIEWERS) {
      if (!userHasAccessTo("staff", [...viewer.staffRoles], WORK_ITEM_KIND_ACCESS[kind])) continue;
      expect(
        entry && userHasAccessTo("staff", [...viewer.staffRoles], entry.requirement),
        `${viewer.label}: ${href}`,
      ).toBe(true);
    }
  });

  it("falls back to the queue page when a review task has no record id", () => {
    expect(adminWorkItemHref("aml_screening", {})).toBe(adminRoutes.aml.list());
    expect(adminWorkItemHref("sof_case", {})).toBe(adminRoutes.sourceOfFunds.list());
    expect(adminWorkItemHref("lot_withdrawal", {})).toBe(adminRoutes.lots.list());
  });

  it("opens an enquiry and a purchase problem by their records", () => {
    expect(adminWorkItemHref("marketing_enquiry", { subjectId: "enq 1" })).toBe(
      "/admin/enquiries/enq%201",
    );
    expect(adminWorkItemHref("purchase_problem", { subjectId: "pp-1" })).toBe(
      "/admin/purchase-problems/pp-1",
    );
    expect(adminWorkItemHref("payment_capture_blocked", { paymentId: "pay-1" })).toBe(
      "/admin/payments?payment=pay-1",
    );
  });

  it("refuses to build a link that needs an id it was not given", () => {
    expect(() => adminWorkItemHref("submission_review", {})).toThrow();
    expect(() => adminWorkItemHref("sale_registration", {})).toThrow();
  });
});

describe("attention feed links", () => {
  const now = new Date("2026-05-03T00:00:00.000Z");
  const old = new Date("2026-04-01T00:00:00.000Z");
  const items = composeAttentionItems({
    now,
    limit: 50,
    submissions: [{ id: "sub-1", title: "A work", status: "submitted", createdAt: old }],
    payments: [{ id: "pay-00000001", status: "pending", createdAt: old }],
    draftLots: [{ id: "lot-1", title: "A lot", startTime: old, createdAt: old }],
  });

  it("produces every kind the feed declares", () => {
    expect(new Set(items.map((item) => item.kind))).toEqual(
      new Set(Object.keys(ATTENTION_KIND_ACCESS)),
    );
  });

  it.each(items.map((item) => [item.kind, item] as const))(
    "%s resolves and opens for everyone who can see it",
    (kind, item) => {
      expect(resolveAdminRoute(item.href), item.href).toBeDefined();
      for (const viewer of VIEWERS) {
        if (!userHasAccessTo("staff", [...viewer.staffRoles], ATTENTION_KIND_ACCESS[kind]))
          continue;
        expect(
          canOpenAdminLink("staff", [...viewer.staffRoles], item.href),
          `${viewer.label}: ${item.href}`,
        ).toBe(true);
      }
    },
  );
});

describe("attention feed viewers", () => {
  it("keeps only the items a finance-only member can open", () => {
    const old = new Date("2026-04-01T00:00:00.000Z");
    const items = composeAttentionItems({
      now: new Date("2026-05-03T00:00:00.000Z"),
      limit: 50,
      submissions: [{ id: "sub-1", title: "A work", status: "submitted", createdAt: old }],
      payments: [{ id: "pay-00000001", status: "pending", createdAt: old }],
      draftLots: [{ id: "lot-1", title: "A lot", startTime: old, createdAt: old }],
    });
    expect(attentionItemsForViewer(items, "staff", ["finance"]).map((i) => i.kind)).toEqual([
      "payment_stale",
    ]);
  });
});

describe("sale readiness links", () => {
  it("every blocker and the sale itself resolve to a known admin page", async () => {
    const service = new AdminSaleReadinessService({
      listUpcomingAndLiveSales: async () => [
        {
          saleId: "sale-1",
          title: "Sale",
          status: "scheduled",
          deliveryMode: "online",
          startTime: new Date("2026-06-01T00:00:00.000Z"),
          lotsTotal: 3,
          lotsPublished: 0,
          lotsDraft: 1,
          lotsMissingPhotos: 1,
          lotsMissingEstimates: 1,
          pendingRegistrations: 1,
          pendingTelephoneBookings: 1,
          sessionStatus: null,
        },
      ],
    });
    const [row] = await service.listReadiness(1);
    expect(row?.blockers).toHaveLength(5);
    for (const href of [row?.href, ...(row?.blockers.map((b) => b.href) ?? [])]) {
      expect(resolveAdminRoute(href ?? ""), href).toBeDefined();
    }
  });
});

describe("route builders", () => {
  /** Calls every builder with sample ids, so a builder added without a table entry fails. */
  function collect(node: unknown, out: string[] = []): string[] {
    if (typeof node === "function") {
      out.push((node as (...args: string[]) => string)("id-1", "pending"));
    } else if (node && typeof node === "object") {
      for (const child of Object.values(node)) collect(child, out);
    }
    return out;
  }

  it("every builder resolves to a route in the table", () => {
    const hrefs = collect(adminRoutes);
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) expect(resolveAdminRoute(href), href).toBeDefined();
  });
});
