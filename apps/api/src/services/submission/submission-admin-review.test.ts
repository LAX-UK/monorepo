import { describe, expect, it, vi } from "vitest";
import {
  SUBMISSION_ID,
  consignmentThreadFixture,
} from "../../testing/consignment-thread-fixture.js";
import { assignForAdmin } from "./submission-admin-review.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

function depsFor(
  assignment: ItemSubmissionServiceDeps["consignmentAssignment"],
  status = "under_review",
) {
  const submission = { id: SUBMISSION_ID, status, assignedToUserId: "clara" };
  const submissions = {
    findById: vi.fn(async () => submission),
    update: vi.fn(async (_id: string, patch: { assignedToUserId: string | null }) => ({
      ...submission,
      ...patch,
    })),
  };
  const deps = {
    submissions,
    users: { findById: vi.fn(async () => ({ id: "omar", role: "staff" })) },
    staffRoles: { listActiveRoles: vi.fn(async () => ["specialist"]) },
    consignmentAssignment: assignment,
  } as unknown as ItemSubmissionServiceDeps;
  return { deps, submissions };
}

describe("assignForAdmin", () => {
  it("hands the thread over with the consignment, so the thread and the history show it", async () => {
    const { assignment, messages, events } = consignmentThreadFixture();
    messages.seedMessage({
      submissionId: SUBMISSION_ID,
      side: "client",
      authorUserId: "lena",
      body: "Any news?",
      at: new Date("2026-10-29T09:00:00Z"),
    });
    const { deps, submissions } = depsFor(assignment);

    const result = await assignForAdmin(deps, "owner", SUBMISSION_ID, "omar");

    expect(result.isOk()).toBe(true);
    expect(messages.subjects.get(SUBMISSION_ID)?.specialist?.userId).toBe("omar");
    expect(messages.events.map((e) => [e.kind, e.actorUserId, e.subjectUserId])).toEqual([
      ["assigned", "owner", "omar"],
    ]);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "consignment_thread.assigned",
        aggregateId: SUBMISSION_ID,
        actorUserId: "owner",
      }),
    );
    expect(submissions.update).not.toHaveBeenCalled();
  });

  it("clears the assignment through the same path", async () => {
    const { assignment, messages } = consignmentThreadFixture();
    messages.seedMessage({
      submissionId: SUBMISSION_ID,
      side: "client",
      authorUserId: "lena",
      body: "Any news?",
      at: new Date("2026-10-29T09:00:00Z"),
    });
    const { deps } = depsFor(assignment);

    await assignForAdmin(deps, "owner", SUBMISSION_ID, null);

    expect(messages.subjects.get(SUBMISSION_ID)?.specialist).toBeNull();
    expect(messages.events.at(-1)?.kind).toBe("unassigned");
  });

  it("still only assigns while the work awaits a decision", async () => {
    const { assignment, messages } = consignmentThreadFixture();
    const { deps } = depsFor(assignment, "approved");

    const result = await assignForAdmin(deps, "owner", SUBMISSION_ID, "omar");

    expect(result.isErr()).toBe(true);
    expect(messages.events).toEqual([]);
  });

  it("changes the record alone where no thread service is wired", async () => {
    const { deps, submissions } = depsFor(null);

    const result = await assignForAdmin(deps, "owner", SUBMISSION_ID, "omar");

    expect(result.isOk()).toBe(true);
    expect(submissions.update).toHaveBeenCalledWith(SUBMISSION_ID, { assignedToUserId: "omar" });
  });
});
