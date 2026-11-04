import { describe, expect, it } from "vitest";
import { groupFailedJobs } from "./failed-job-groups";
import { emailJob, xeroDelivery, zohoDelivery } from "./failed-job.fixture";

const again = (id: string, patch: Partial<typeof xeroDelivery> = {}) => ({
  ...xeroDelivery,
  id,
  ...patch,
});

describe("groupFailedJobs", () => {
  it("folds identical failures into one row, in the order they first appear", () => {
    const groups = groupFailedJobs([
      xeroDelivery,
      zohoDelivery,
      again("delivery:43"),
      again("delivery:44"),
    ]);
    expect(groups.map((group) => [group.typeLabel, group.members.length])).toEqual([
      ["Payment to Xero", 3],
      ["User registered to Zoho CRM", 1],
    ]);
    expect(groups[0]?.members.map((member) => member.id)).toEqual([
      "delivery:41",
      "delivery:43",
      "delivery:44",
    ]);
    expect(groups[0]?.id).toBe("delivery:41");
  });

  it("spans the group's dates and takes its highest attempts", () => {
    const [group] = groupFailedJobs([
      xeroDelivery,
      again("delivery:43", {
        attempts: 9,
        firstFailedAt: "2026-10-31T07:12:00.000Z",
        lastFailedAt: "2026-11-02T07:44:00.000Z",
      }),
    ]);
    expect(group).toMatchObject({
      attempts: 9,
      firstFailedAt: "2026-10-31T07:12:00.000Z",
      lastFailedAt: "2026-11-02T07:44:00.000Z",
    });
  });

  it("keeps a different error, a different kind or a different state apart", () => {
    const groups = groupFailedJobs([
      xeroDelivery,
      again("delivery:43", { errorSummary: "Xero API 429" }),
      again("delivery:44", { state: "retried" }),
      again("delivery:45", { queue: "webhook:xero" }),
      emailJob,
    ]);
    expect(groups).toHaveLength(5);
  });

  it("offers Retry for the group when any member can be retried", () => {
    const [group] = groupFailedJobs([
      again("delivery:43", { retry: { allowed: false, reason: "Already retried." } }),
      xeroDelivery,
    ]);
    expect(group?.retry).toEqual({ allowed: true });
  });

  it("explains a group that none can retry, with the reason of the first refused", () => {
    const [group] = groupFailedJobs([
      again("delivery:43", { retry: { allowed: false, reason: "Switched off." } }),
      again("delivery:44", { retry: { allowed: false, reason: "Switched off." } }),
    ]);
    expect(group?.retry).toEqual({ allowed: false, reason: "Switched off." });
  });

  it("lets a person act on the group only when they may act on every member", () => {
    const [group] = groupFailedJobs([xeroDelivery, again("delivery:43", { canAct: false })]);
    expect(group?.canAct).toBe(false);
  });
});
