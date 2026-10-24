import type { AuditLogRecord, IAdminDomainEventReader } from "@auction/persistence/interfaces";
import { AUDIT_LOG_VIEW_PREFIXES } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AdminAuditLogService, toAuditLogEntry } from "./admin-audit-log.service.js";

// Fake credential shapes, assembled so no scanner mistakes them for real keys.
const FAKE_TOKEN = ["tok", "0123456789abcdef"].join("_");
const FAKE_WEBHOOK = ["whsec", "0123456789"].join("_");

function record(overrides: Partial<AuditLogRecord> = {}): AuditLogRecord {
  return {
    id: 7,
    aggregateType: "user",
    aggregateId: "user-1",
    eventType: "auth.two_factor_reset_by_staff",
    payload: { reason: "Lost phone" },
    actorUserId: "staff-1",
    actorName: "Ada Staff",
    actorEmail: "ada@example.com",
    actorIsStaff: true,
    actingLegalEntityId: null,
    occurredAt: new Date("2026-10-24T09:30:00Z"),
    ...overrides,
  };
}

function readerReturning(rows: AuditLogRecord[], total = rows.length) {
  const searchAuditLog = vi.fn().mockResolvedValue({ rows, total });
  const searchAuditActors = vi.fn().mockResolvedValue([]);
  const reader = {
    searchAuditLog,
    searchAuditActors,
    listRedacted: vi.fn(),
    countForExport: vi.fn(),
  } satisfies IAdminDomainEventReader;
  return { reader, searchAuditLog, searchAuditActors };
}

describe("toAuditLogEntry", () => {
  it("names a staff actor even without PII access", () => {
    const entry = toAuditLogEntry(record(), false);
    expect(entry.id).toBe("7");
    expect(entry.actor).toEqual({ kind: "staff", name: "Ada Staff", email: "ada@example.com" });
  });

  it("hides a client's identity without PII access and shows it with it", () => {
    const client = record({
      actorUserId: "client-1",
      actorName: "Jane Client",
      actorEmail: "jane@example.com",
      actorIsStaff: false,
    });
    expect(toAuditLogEntry(client, false).actor).toEqual({
      kind: "client",
      name: null,
      email: null,
    });
    expect(toAuditLogEntry(client, true).actor).toEqual({
      kind: "client",
      name: "Jane Client",
      email: "jane@example.com",
    });
  });

  it("has no actor for system events", () => {
    expect(toAuditLogEntry(record({ actorUserId: null }), false).actor).toBeNull();
  });

  it("minimises free text without PII access", () => {
    const entry = toAuditLogEntry(
      record({ eventType: "bid.placed", payload: { bidId: "b1", note: "call me on 555" } }),
      false,
    );
    expect(entry.payload).toEqual({ bidId: "b1", note: "[REDACTED]" });
  });

  it("never exposes credentials, even to a caller who may read PII", () => {
    const entry = toAuditLogEntry(
      record({
        payload: {
          reason: "Lost phone",
          accessToken: FAKE_TOKEN,
          nested: { password: "hunter2", webhook: FAKE_WEBHOOK },
        },
      }),
      true,
    );
    expect(entry.payload).toEqual({
      reason: "Lost phone",
      accessToken: "[REDACTED]",
      nested: { password: "[REDACTED]", webhook: "[REDACTED]" },
    });
  });
});

describe("AdminAuditLogService", () => {
  it("expands a view into its event-type prefixes and passes the filters on", async () => {
    const { reader, searchAuditLog } = readerReturning([record()], 41);
    const service = new AdminAuditLogService(reader);

    const page = await service.search({
      limit: 50,
      offset: 0,
      view: "people",
      q: "reset",
      actorUserId: "staff-1",
      fromDay: "2026-10-01",
      toDay: "2026-10-24",
      includePii: false,
    });

    expect(page.total).toBe(41);
    expect(page.rows).toHaveLength(1);
    expect(searchAuditLog).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      matchClientActors: false,
      q: "reset",
      actorUserId: "staff-1",
      eventTypePrefixes: AUDIT_LOG_VIEW_PREFIXES.people,
      fromDay: "2026-10-01",
      toDay: "2026-10-24",
    });
  });

  it("lets text search reach client identities only with PII access", async () => {
    const { reader, searchAuditLog } = readerReturning([]);
    const service = new AdminAuditLogService(reader);

    await service.search({ limit: 10, offset: 0, q: "jane", includePii: true });

    expect(searchAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ matchClientActors: true }),
    );
  });

  it("offers only staff as actors without PII access", async () => {
    const { reader, searchAuditActors } = readerReturning([]);
    searchAuditActors.mockResolvedValue([
      { userId: "staff-1", name: "Ada Staff", email: "ada@example.com", isStaff: true },
    ]);
    const service = new AdminAuditLogService(reader);

    const actors = await service.searchActors({ q: "ada", limit: 20, includePii: false });

    expect(searchAuditActors).toHaveBeenCalledWith({ q: "ada", limit: 20, staffOnly: true });
    expect(actors).toEqual([{ userId: "staff-1", name: "Ada Staff", email: "ada@example.com" }]);
    await service.searchActors({ limit: 20, includePii: true });
    expect(searchAuditActors).toHaveBeenLastCalledWith({ limit: 20, staffOnly: false });
  });
});
