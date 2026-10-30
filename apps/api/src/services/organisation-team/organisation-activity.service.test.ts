import type { ActivityEventRecord } from "@auction/domain";
import type { IOrganisationActivityReader } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { OrganisationActivityService } from "./organisation-activity.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-30T12:00:00Z");

function record(id: number, overrides: Partial<ActivityEventRecord> = {}): ActivityEventRecord {
  return {
    id,
    eventType: "legal_entity.member_role_changed",
    occurredAt: new Date(NOW.getTime() - id * 60_000),
    actorUserId: "owner-1",
    payload: { member_user_id: "m-1", from_role: "viewer", to_role: "finance" },
    ...overrides,
  };
}

function setup(rows: ActivityEventRecord[]) {
  const reader: IOrganisationActivityReader = {
    list: vi.fn(async (filter) =>
      rows.filter((row) => !filter.beforeId || row.id < filter.beforeId).slice(0, filter.limit),
    ),
    people: vi.fn(
      async () =>
        new Map([
          ["owner-1", { name: "Olivia Owner", wasMember: true }],
          ["m-1", { name: "Max Member", wasMember: true }],
          ["staff-1", { name: "Sam Staff", wasMember: false }],
        ]),
    ),
  };
  return { service: new OrganisationActivityService({ activity: reader, now: () => NOW }), reader };
}

const actor = (role: LegalEntityMemberRole) => ({ userId: "me", legalEntityId: ENTITY, role });

describe("OrganisationActivityService", () => {
  it("lists named entries, newest first, with the next page", async () => {
    const { service, reader } = setup([record(3), record(2), record(1)]);
    const page = (await service.list(actor("admin"), { limit: 2 }))._unsafeUnwrap();
    expect(page.entries.map((entry) => entry.id)).toEqual([3, 2]);
    expect(page.entries[0]).toMatchObject({
      kind: "role_changed",
      actorName: "Olivia Owner",
      subjectName: "Max Member",
      detail: { from_role: "viewer", to_role: "finance" },
    });
    expect(page.nextBefore).toBe(2);
    // Twelve months back at most, every Activity type when no group is chosen.
    expect(reader.list).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: ENTITY,
        since: new Date("2025-10-30T12:00:00Z"),
        limit: 3,
      }),
    );
  });

  it("names staff and the system as LAX", async () => {
    const { service } = setup([
      record(2, { actorUserId: "staff-1" }),
      record(1, { actorUserId: null, eventType: "payout.paid", payload: { netAmount: "900.00" } }),
    ]);
    const page = (await service.list(actor("owner"), { limit: 10 }))._unsafeUnwrap();
    expect(page.entries.map((entry) => entry.actorName)).toEqual(["LAX", "LAX"]);
  });

  it("never reaches further back than twelve months, whatever the filter asks", async () => {
    const { service, reader } = setup([]);
    await service.list(actor("owner"), {
      limit: 10,
      from: "2020-01-01T00:00:00Z",
      group: ["money"],
      person: "m-1",
    });
    expect(reader.list).toHaveBeenCalledWith(
      expect.objectContaining({
        since: new Date("2025-10-30T12:00:00Z"),
        eventTypes: [
          "payout.paid",
          "legal_entity.payout_bank_changed",
          "legal_entity.invoice_details_changed",
        ],
        personUserId: "m-1",
      }),
    );
  });

  it.each(["finance", "consignor", "buyer_agent", "viewer"] as const)(
    "refuses %s",
    async (role) => {
      const { service, reader } = setup([record(1)]);
      expect((await service.list(actor(role), { limit: 10 }))._unsafeUnwrapErr().status).toBe(403);
      expect((await service.exportCsv(actor(role), {})).isErr()).toBe(true);
      expect(reader.list).not.toHaveBeenCalled();
    },
  );

  it("exports every page as CSV in plain words, never raw codes", async () => {
    const { service } = setup([record(2), record(1)]);
    const { csv, truncated } = (await service.exportCsv(actor("owner"), {}))._unsafeUnwrap();
    expect(truncated).toBe(false);
    expect(csv.startsWith("﻿Date (UTC),Who,What,About,Details\n")).toBe(true);
    expect(csv).toContain("Olivia Owner,Role changed,Max Member,Viewer to Finance");
    expect(csv).not.toContain("role_changed");
  });
});
