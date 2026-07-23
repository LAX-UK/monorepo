import { afterEach, describe, expect, it, vi } from "vitest";
import { DrizzleAdminOnboardingIssuesReader } from "./drizzle-admin-onboarding-issues.reader.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DrizzleAdminOnboardingIssuesReader.summarizeEntitiesPendingReview", () => {
  it("aggregates docs_received and under_review from the same pending-review predicate", async () => {
    const from = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([
        {
          total: 3,
          docsReceived: 1,
          underReview: 2,
        },
      ]),
    });
    const select = vi.fn().mockReturnValue({ from });
    const repo = new DrizzleAdminOnboardingIssuesReader({ select } as never);

    await expect(repo.summarizeEntitiesPendingReview()).resolves.toEqual({
      total: 3,
      docsReceived: 1,
      underReview: 2,
    });
    expect(from).toHaveBeenCalledOnce();
  });
});

describe("DrizzleAdminOnboardingIssuesReader.listEntitiesPendingReview", () => {
  it("returns lens total matching summarize predicate scope", async () => {
    const countWhere = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ n: 2 }]),
    });
    const countSelect = vi.fn().mockReturnValue({ from: countWhere });

    const listWhere = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue([
            {
              id: "le-1",
              displayName: "Gallery",
              status: "under_review",
              createdAt: new Date("2026-01-01T00:00:00Z"),
              updatedAt: new Date("2026-01-02T00:00:00Z"),
              statusChangedAt: null,
            },
          ]),
        }),
      }),
    });
    const listFrom = vi.fn().mockReturnValue({ where: listWhere });
    const listSelect = vi.fn().mockReturnValue({ from: listFrom });

    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => countSelect())
        .mockImplementationOnce(() => listSelect()),
    };

    const repo = new DrizzleAdminOnboardingIssuesReader(db as never);
    const result = await repo.listEntitiesPendingReview({ limit: 25, offset: 0 });

    expect(result.total).toBe(2);
    expect(result.rows).toHaveLength(1);
  });
});
