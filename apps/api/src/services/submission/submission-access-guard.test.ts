import type { ListSubmissionsFilter } from "@auction/persistence/interfaces";
import type { ItemSubmission } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { SubmissionAccessGuard } from "./submission-access-guard.js";

const ENTITY = "le-gallery";
const consignor = {
  legalEntityId: ENTITY,
  member: { userId: "u1", actor: { role: "consignor" as const } },
};

/** 1,500 submissions, every third one sent by the consignor. */
const ALL = Array.from({ length: 1500 }, (_, i) => ({
  id: `s${i}`,
  legalEntityId: ENTITY,
  submittedByUserId: i % 3 === 0 ? "u1" : "u2",
})) as ItemSubmission[];

function guard() {
  const listForLegalEntity = vi.fn(async (_entity: string, f: ListSubmissionsFilter) =>
    ALL.filter((s) => (f.ids ? f.ids.includes(s.id) : true))
      .filter((s) => f.visibleTo?.scope !== "own" || s.submittedByUserId === f.visibleTo.userId)
      .slice(f.offset, f.offset + f.limit),
  );
  return {
    listForLegalEntity,
    guard: new SubmissionAccessGuard({ findById: vi.fn(), listForLegalEntity }),
  };
}

describe("SubmissionAccessGuard.keepVisible", () => {
  it("keeps every visible row of a long list, asking only about the rows' own submissions", async () => {
    const { guard: g, listForLegalEntity } = guard();
    const rows = ALL.map((s) => ({ submissionId: s.id }));
    const kept = await g.keepVisible(consignor, rows);
    expect(kept).toHaveLength(500);
    expect(kept.at(-1)).toEqual({ submissionId: "s1497" });
    const filter = listForLegalEntity.mock.calls[0]?.[1];
    expect(filter?.ids).toHaveLength(1500);
    expect(filter?.limit).toBe(1500);
  });

  it("returns everything for members who see every submission, without a read", async () => {
    const { guard: g, listForLegalEntity } = guard();
    const owner = {
      legalEntityId: ENTITY,
      member: { userId: "u9", actor: { role: "owner" as const } },
    };
    expect(await g.keepVisible(owner, [{ submissionId: "s1" }])).toEqual([{ submissionId: "s1" }]);
    expect(listForLegalEntity).not.toHaveBeenCalled();
  });

  it("reads nothing for an empty list", async () => {
    const { guard: g, listForLegalEntity } = guard();
    expect(await g.keepVisible(consignor, [])).toEqual([]);
    expect(listForLegalEntity).not.toHaveBeenCalled();
  });
});
