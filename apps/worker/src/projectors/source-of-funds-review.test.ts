import type { IEmailService } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import { processSourceOfFundsReview } from "./source-of-funds-review.js";

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

describe("processSourceOfFundsReview", () => {
  it("reactivates an existing task when the case is reopened", async () => {
    const eventRow = {
      id: 9,
      aggregateId: "sof_1",
      payload: {
        sourceOfFundsId: "sof_1",
        userId: "u1",
        reopened: true,
      },
    };
    const db = fakeDb([
      undefined,
      [{ last: 0 }],
      [eventRow],
      [{ id: "task_1", status: "resolved" }],
      undefined,
      undefined,
    ]);
    const emailService = { enqueue: vi.fn() } as unknown as IEmailService;

    await processSourceOfFundsReview({
      db,
      log,
      emailService,
      supportContactEmail: "compliance@example.com",
      webOrigin: "https://app.example.com",
    });

    expect(emailService.enqueue).not.toHaveBeenCalled();
  });

  it("notifies the buyer when a new SoF case/task is created", async () => {
    const eventRow = {
      id: 12,
      aggregateId: "sof_2",
      payload: {
        sourceOfFundsId: "sof_2",
        userId: "buyer_1",
        trigger: "threshold",
        exposureAmount: "12000.00",
        currency: "GBP",
      },
    };
    const db = fakeDb([
      undefined, // insert projectorState (onConflictDoNothing)
      [{ last: 0 }], // cursor
      [eventRow], // domain events
      [], // existing task lookup -> none -> createdTask
      undefined, // insert adminReviewTask
      [], // listComplianceRecipients -> none
      [{ email: "buyer@example.com", firstName: "Bee" }], // buyer lookup
      undefined, // update cursor
    ]);
    const emailService = { enqueue: vi.fn() } as unknown as IEmailService;

    await processSourceOfFundsReview({
      db,
      log,
      emailService,
      supportContactEmail: "compliance@example.com",
      webOrigin: "https://app.example.com",
    });

    expect(emailService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "source-of-funds-buyer-notice",
        to: "buyer@example.com",
        userId: "buyer_1",
        idempotencyKey: "source-of-funds-buyer-notice:sof_2",
      }),
    );
  });
});
