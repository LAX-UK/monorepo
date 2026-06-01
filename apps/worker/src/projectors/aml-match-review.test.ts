import type { IEmailService } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import { processAmlMatchReview } from "./aml-match-review.js";

/**
 * Builds a chainable Drizzle-like fake whose terminal awaits resolve, in call
 * order, from `results`. Every query-builder method returns the same proxy so
 * `.from().where().limit()` etc. all chain, and awaiting shifts the next result.
 */
function fakeDb(results: unknown[]) {
  const make = () => {
    const proxy: unknown = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === "then") {
          const value = results.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return () => proxy;
      },
    });
    return proxy;
  };
  return new Proxy(
    {},
    {
      get() {
        return () => make();
      },
    },
  ) as never;
}

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

function makeEmail(): IEmailService {
  return { enqueue: vi.fn().mockResolvedValue(undefined) } as unknown as IEmailService;
}

describe("processAmlMatchReview MLRO escalation", () => {
  it("enqueues exactly one idempotent compliance email per recipient", async () => {
    const eventRow = {
      id: 7,
      aggregateId: "scr_1",
      payload: {
        screeningId: "scr_1",
        userId: "u1",
        matchStatus: "possible_match",
        categories: "pep",
      },
    };
    const recipient = { id: "mlro_1", email: "mlro@example.com", firstName: "M" };
    const db = fakeDb([
      undefined, // insert projectorState ... onConflictDoNothing
      [{ last: 0 }], // cursor select
      [eventRow], // events select
      [], // existing admin_review_task select (none)
      undefined, // insert admin_review_task
      [recipient], // listComplianceRecipients select
      undefined, // update projectorState cursor
    ]);
    const emailService = makeEmail();

    await processAmlMatchReview({
      db,
      log,
      emailService,
      supportContactEmail: "compliance@example.com",
      webOrigin: "https://app.example.com",
      adminEmailAddress: "ops@example.com",
    });

    expect(emailService.enqueue).toHaveBeenCalledTimes(1);
    expect(emailService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "aml-compliance-review-notice",
        to: "mlro@example.com",
        idempotencyKey: "aml-compliance-review-notice:screening:scr_1:mlro_1",
        vars: expect.objectContaining({ kind: "screening", caseReference: "scr_1" }),
      }),
    );
  });

  it("does not enqueue email when the review task already exists", async () => {
    const eventRow = {
      id: 8,
      aggregateId: "scr_2",
      payload: { screeningId: "scr_2", userId: "u2", matchStatus: "possible_match" },
    };
    const db = fakeDb([
      undefined,
      [{ last: 0 }],
      [eventRow],
      [{ id: "task_existing" }], // existing admin_review_task
      undefined, // cursor update
    ]);
    const emailService = makeEmail();

    await processAmlMatchReview({
      db,
      log,
      emailService,
      supportContactEmail: "compliance@example.com",
      webOrigin: "https://app.example.com",
    });

    expect(emailService.enqueue).not.toHaveBeenCalled();
  });

  it("does not send when there are no flagged events", async () => {
    const db = fakeDb([
      undefined, // insert projectorState
      [{ last: 0 }], // cursor select
      [], // events select (none) → early return
    ]);
    const emailService = makeEmail();

    await processAmlMatchReview({
      db,
      log,
      emailService,
      supportContactEmail: "compliance@example.com",
      webOrigin: "https://app.example.com",
    });

    expect(emailService.enqueue).not.toHaveBeenCalled();
  });
});
