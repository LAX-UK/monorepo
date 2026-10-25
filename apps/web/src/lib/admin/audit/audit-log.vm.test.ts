import type { AdminAuditLogRow } from "@/lib/data/http/admin-audit.schema";
import { describe, expect, it } from "vitest";
import {
  auditActionTone,
  auditEntityHref,
  auditEntityTypeLabel,
  toAuditLogRows,
} from "./audit-log.vm";
import { toTimelineEvents } from "./audit-timeline";

function row(overrides: Partial<AdminAuditLogRow> = {}): AdminAuditLogRow {
  return {
    id: "1",
    aggregateType: "lot",
    aggregateId: "0b7e4a52-8b3c-4e97-a4d6-2c9e7b1f5a08",
    eventType: "lot.withdrawal_declined",
    payload: { reason: "Still consigned" },
    actorUserId: "staff-1",
    actingLegalEntityId: null,
    occurredAt: new Date("2026-10-24T09:30:00Z"),
    actor: { kind: "staff", name: "Ada Staff", email: "ada@example.com" },
    ...overrides,
  };
}

const platform = { canOpenPlatformRoutes: true };

describe("toAuditLogRows", () => {
  it("shows the actor by name and email, the action as a sentence and a link to the record", () => {
    const [model] = toAuditLogRows([row()], platform);
    expect(model).toMatchObject({
      action: "Withdrawal declined",
      actionCode: "lot.withdrawal_declined",
      tone: "danger",
      summary: "Reason: Still consigned",
      actor: { name: "Ada Staff", email: "ada@example.com", kind: "staff" },
      entity: { typeLabel: "Lot", id: "0b7e4a52-8b3c-4e97-a4d6-2c9e7b1f5a08" },
    });
    expect(model?.entity.href).toBe("/admin/lots/0b7e4a52-8b3c-4e97-a4d6-2c9e7b1f5a08");
    expect(model?.at).toBe("2026-10-24T09:30:00.000Z");
  });

  it("names system events and hides a client the API withheld", () => {
    const [system, client] = toAuditLogRows(
      [
        row({ actorUserId: null, actor: null }),
        row({ actor: { kind: "client", name: null, email: null } }),
      ],
      platform,
    );
    expect(system?.actor).toEqual({ name: "System", email: null, kind: "system" });
    expect(client?.actor).toEqual({ name: "A client", email: null, kind: "client" });
  });

  it("carries the diff into the row", () => {
    const [model] = toAuditLogRows(
      [row({ payload: { before: { status: "draft" }, after: { status: "live" } } })],
      platform,
    );
    expect(model?.detail.changes).toHaveLength(1);
    expect(model?.summary).toBe("Status: draft → live");
  });
});

describe("entity links", () => {
  it("links the records that have a page", () => {
    expect(auditEntityHref("sale", "s1", platform)).toBe("/admin/sales/s1");
    expect(auditEntityHref("legal_entity", "e1", platform)).toBe("/admin/legal-entities/e1");
    expect(auditEntityHref("payment", "p1", platform)).toBeNull();
  });

  it("does not link pages the finance shell cannot open", () => {
    expect(auditEntityHref("lot", "l1", { canOpenPlatformRoutes: false })).toBeNull();
  });

  it("labels known and unknown types", () => {
    expect(auditEntityTypeLabel("source_of_funds")).toBe("Source of Funds case");
    expect(auditEntityTypeLabel("widget_batch")).toBe("Widget batch");
  });
});

describe("auditActionTone", () => {
  it.each([
    ["lot.withdrawal_declined", "danger"],
    ["payout.transfer_failed", "danger"],
    ["payment.captured", "success"],
    ["auth.two_factor_reset_by_staff", "warning"],
    ["bid.outbid", "neutral"],
  ])("%s is %s", (type, tone) => {
    expect(auditActionTone(type)).toBe(tone);
  });
});

describe("toTimelineEvents", () => {
  it("orders newest first with actor names and the change as detail", () => {
    const events = toTimelineEvents([
      row({ id: "old", occurredAt: new Date("2026-10-01T09:00:00Z") }),
      row({
        id: "new",
        eventType: "lot.published",
        payload: {},
        occurredAt: new Date("2026-10-24T09:00:00Z"),
        actorUserId: null,
        actor: null,
      }),
    ]);
    expect(events.map((e) => e.id)).toEqual(["new", "old"]);
    expect(events[0]).toMatchObject({ title: "Lot scheduled", actor: "System", tone: "success" });
    expect(events[1]).toMatchObject({ actor: "Ada Staff", detail: "Reason: Still consigned" });
  });

  it("falls back to a generic staff label when only an id is known", () => {
    const [event] = toTimelineEvents([
      { ...row(), actor: undefined } as unknown as AdminAuditLogRow,
    ]);
    expect(event?.actor).toBe("Staff member");
  });
});
