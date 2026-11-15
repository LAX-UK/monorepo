import { INVOICE_DELAYED_AFTER_MS, ok, refuse } from "@auction/accounting-domain";
import type {
  AccountingAttention,
  IAccountingSourceSettingReader,
  QueueAge,
  StuckRefundReversal,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { ACCOUNTING_ALERTS, type AccountingAlertSink } from "./accounting-alerts.js";
import {
  AccountingWatch,
  PAYMENT_WAITING_AFTER_MS,
  REFUND_REVERSAL_STUCK_AFTER_MS,
  REMAINDER_UNSETTLED_AFTER_MS,
  SENDER_MISSED_AFTER_MS,
  STATUS_CHECK_MISSED_AFTER_MS,
} from "./accounting-watch.service.js";

const books = (mode: "off" | "dry_run" | "test_org" | "live") =>
  ({ xero: "off", books: mode }) as const;
const switchWith = (
  mode: "off" | "dry_run" | "test_org" | "live",
): IAccountingSourceSettingReader => ({
  read: async () => ok({ bid: books(mode), shop: books("off"), lax_art: books("off") }),
});

const none = { count: 0, oldestSince: null };

function setUp(
  attention: Partial<AccountingAttention>,
  now: string,
  mode: "off" | "dry_run" = "dry_run",
  delayed: QueueAge = none,
  waiting: QueueAge = none,
  unsettled: QueueAge = none,
  unrefunded: QueueAge = none,
  stuck: () => readonly StuckRefundReversal[] = () => [],
) {
  const raised: [string, Record<string, unknown>][] = [];
  const alerts: AccountingAlertSink = {
    raise: (alert, details) => void raised.push([alert.message, details]),
  };
  const read = vi.fn(async () => ({ needsPerson: none, pending: none, ...attention }));
  const delayedBidInvoices = vi.fn(async () => delayed);
  const waitingPayments = vi.fn(async () => waiting);
  const unsettledRemainders = vi.fn(async () => unsettled);
  const unrefundedCreditNotes = vi.fn(async () => unrefunded);
  const stuckRefundReversals = vi.fn(async () => stuck());
  const watch = new AccountingWatch({
    attention: {
      read,
      delayedBidInvoices,
      waitingPayments,
      unsettledRemainders,
      unrefundedCreditNotes,
      stuckRefundReversals,
    },
    settings: switchWith(mode),
    senderModes: ["dry_run"],
    alerts,
    now: () => new Date(now),
  });
  return {
    watch,
    raised,
    read,
    delayedBidInvoices,
    waitingPayments,
    unsettledRemainders,
    unrefundedCreditNotes,
    stuckRefundReversals,
  };
}

describe("AccountingWatch", () => {
  it("raises nothing when the queue is quiet", async () => {
    const { watch, raised } = setUp({}, "2026-11-13T12:00:00Z");
    expect(await watch.check()).toEqual({
      needsPersonOverdue: false,
      senderMissed: false,
      bidInvoiceDelayed: false,
      paymentWaiting: false,
      remainderDelayed: false,
      statusCheckMissed: false,
      creditNoteRefundDelayed: false,
      refundReversalsStuck: { waiting: 0, raised: 0 },
    });
    expect(raised).toEqual([]);
  });

  it("raises a document that has waited for a person more than one working day", async () => {
    // Thursday 10:00 to Friday 10:30 London: 9.5 working hours.
    const { watch, raised } = setUp(
      { needsPerson: { count: 3, oldestSince: new Date("2026-11-12T10:00:00Z") } },
      "2026-11-13T10:30:00Z",
    );
    expect((await watch.check()).needsPersonOverdue).toBe(true);
    expect(raised).toEqual([
      [
        ACCOUNTING_ALERTS.needsPersonOverdue.message,
        { count: 3, oldestSince: "2026-11-12T10:00:00.000Z", page: "/admin/finance/accounting" },
      ],
    ]);
  });

  it("counts working time only: Friday afternoon to Monday morning is not a working day", async () => {
    const { watch, raised } = setUp(
      { needsPerson: { count: 1, oldestSince: new Date("2026-11-13T16:00:00Z") } },
      "2026-11-16T10:00:00Z",
    );
    expect((await watch.check()).needsPersonOverdue).toBe(false);
    expect(raised).toEqual([]);
  });

  it("raises a sender that has left queued documents unclaimed", async () => {
    const now = new Date("2026-11-13T12:00:00Z");
    const { watch, raised, read } = setUp(
      {
        pending: { count: 7, oldestSince: new Date(now.getTime() - SENDER_MISSED_AFTER_MS - 1) },
      },
      now.toISOString(),
    );
    expect((await watch.check()).senderMissed).toBe(true);
    expect(read).toHaveBeenCalledWith(["dry_run"]);
    expect(raised[0]?.[0]).toBe(ACCOUNTING_ALERTS.senderMissed.message);
    expect(raised[0]?.[1]).toMatchObject({ count: 7, modes: ["dry_run"] });
  });

  it("asks about no sender modes while Books is off or the switch cannot be read", async () => {
    const off = setUp({}, "2026-11-13T12:00:00Z", "off");
    await off.watch.check();
    expect(off.read).toHaveBeenCalledWith([]);

    const read = vi.fn(async () => ({ needsPerson: none, pending: none }));
    const unreadable = new AccountingWatch({
      attention: {
        read,
        delayedBidInvoices: vi.fn(async () => none),
        waitingPayments: vi.fn(async () => none),
        unsettledRemainders: vi.fn(async () => none),
        unrefundedCreditNotes: vi.fn(async () => none),
        stuckRefundReversals: vi.fn(async () => []),
      },
      settings: { read: async () => refuse("bad_mode", "broken") },
      senderModes: ["dry_run"],
      alerts: { raise: vi.fn() },
      now: () => new Date(),
    });
    await unreadable.check();
    expect(read).toHaveBeenCalledWith([]);
  });

  it("raises a buyer's invoice still being prepared after 30 minutes, as the card says", async () => {
    const now = new Date("2026-11-13T12:00:00Z");
    const oldest = new Date(now.getTime() - INVOICE_DELAYED_AFTER_MS - 60_000);
    const { watch, raised, delayedBidInvoices } = setUp({}, now.toISOString(), "dry_run", {
      count: 2,
      oldestSince: oldest,
    });
    expect((await watch.check()).bidInvoiceDelayed).toBe(true);
    // Asked about invoices queued more than 30 minutes ago, in the modes Books is aimed at.
    expect(delayedBidInvoices).toHaveBeenCalledWith(
      ["dry_run"],
      new Date(now.getTime() - INVOICE_DELAYED_AFTER_MS),
    );
    expect(raised).toEqual([
      [
        ACCOUNTING_ALERTS.bidInvoiceDelayed.message,
        {
          count: 2,
          oldestSince: oldest.toISOString(),
          modes: ["dry_run"],
          page: "/admin/finance/accounting",
        },
      ],
    ]);
  });

  it("raises the delayed-accounting alert for payments still waiting for their invoice after six hours", async () => {
    const now = new Date("2026-11-13T18:00:00Z");
    const oldest = new Date(now.getTime() - PAYMENT_WAITING_AFTER_MS - 60_000);
    const { watch, raised, waitingPayments } = setUp({}, now.toISOString(), "dry_run", none, {
      count: 1,
      oldestSince: oldest,
    });
    expect((await watch.check()).paymentWaiting).toBe(true);
    expect(waitingPayments).toHaveBeenCalledWith(
      ["dry_run"],
      new Date(now.getTime() - PAYMENT_WAITING_AFTER_MS),
    );
    expect(raised).toEqual([
      [
        ACCOUNTING_ALERTS.bidInvoiceDelayed.message,
        {
          documentType: "payment",
          count: 1,
          oldestSince: oldest.toISOString(),
          modes: ["dry_run"],
          page: "/admin/finance/accounting?tab=waiting",
        },
      ],
    ]);
  });

  it("raises delayed accounting for a Shop delivery invoice issued six hours ago whose payment's rest is not applied", async () => {
    const now = new Date("2026-11-13T18:00:00Z");
    const oldest = new Date(now.getTime() - REMAINDER_UNSETTLED_AFTER_MS - 60_000);
    const { watch, raised, unsettledRemainders } = setUp(
      {},
      now.toISOString(),
      "dry_run",
      none,
      none,
      { count: 1, oldestSince: oldest },
    );
    expect((await watch.check()).remainderDelayed).toBe(true);
    expect(unsettledRemainders).toHaveBeenCalledWith(
      ["dry_run"],
      new Date(now.getTime() - REMAINDER_UNSETTLED_AFTER_MS),
    );
    expect(raised).toEqual([
      [
        ACCOUNTING_ALERTS.shopRemainderDelayed.message,
        {
          documentType: "invoice",
          count: 1,
          oldestSince: oldest.toISOString(),
          modes: ["dry_run"],
          page: "/admin/finance/accounting",
        },
      ],
    ]);
  });

  describe("refund reversals waiting on a credit note", () => {
    const NOW = new Date("2026-11-14T12:00:00Z");
    const reversal = (deliveryId: number): StuckRefundReversal => ({
      deliveryId,
      eventId: 1_000 + deliveryId,
      eventType: "payment.refund_reversed",
      waitingSince: new Date(NOW.getTime() - REFUND_REVERSAL_STUCK_AFTER_MS - 60_000),
      lastError: "accounting_projection_not_yet:credit_in_flight:LAX-BID-CN-1",
    });

    it("asks for reversals queued more than six hours ago and raises each one once", async () => {
      let stuck = [reversal(1)];
      const { watch, raised, stuckRefundReversals } = setUp(
        {},
        NOW.toISOString(),
        "dry_run",
        none,
        none,
        none,
        none,
        () => stuck,
      );
      expect((await watch.check()).refundReversalsStuck).toEqual({ waiting: 1, raised: 1 });
      expect(stuckRefundReversals).toHaveBeenCalledWith(
        new Date(NOW.getTime() - REFUND_REVERSAL_STUCK_AFTER_MS),
        expect.any(Number),
      );
      expect(raised).toEqual([
        [
          ACCOUNTING_ALERTS.refundReversalStuck.message,
          {
            deliveryId: 1,
            sourceEvent: "domain_event:1001",
            eventType: "payment.refund_reversed",
            waitingSince: stuck[0]?.waitingSince.toISOString(),
            lastError: "accounting_projection_not_yet:credit_in_flight:LAX-BID-CN-1",
            page: "/admin/finance/accounting",
          },
        ],
      ]);
      // Still waiting on the next runs: nothing raised again. A second one stuck: only it is raised.
      expect((await watch.check()).refundReversalsStuck).toEqual({ waiting: 1, raised: 0 });
      stuck = [reversal(1), reversal(2)];
      expect((await watch.check()).refundReversalsStuck).toEqual({ waiting: 2, raised: 1 });
      expect(raised.map(([message, details]) => [message, details.deliveryId])).toEqual([
        [ACCOUNTING_ALERTS.refundReversalStuck.message, 1],
        [ACCOUNTING_ALERTS.refundReversalStuck.message, 2],
      ]);
      expect(raised).toHaveLength(2);
    });

    it("forgets a reversal once it settles", async () => {
      let stuck = [reversal(1)];
      const { watch, raised } = setUp(
        {},
        NOW.toISOString(),
        "dry_run",
        none,
        none,
        none,
        none,
        () => stuck,
      );
      await watch.check();
      stuck = [];
      expect((await watch.check()).refundReversalsStuck).toEqual({ waiting: 0, raised: 0 });
      // Seen stuck again later (the same delivery waiting once more): raised again, once.
      stuck = [reversal(1)];
      await watch.check();
      await watch.check();
      expect(raised).toHaveLength(2);
    });
  });

  describe("the nightly Books status check", () => {
    const NOW = new Date("2026-11-14T12:00:00Z");
    const watchWith = (
      last: Date | null,
      expectedSince: Date,
      mode: "off" | "dry_run" = "dry_run",
      firstStarted: Date | null = null,
    ) => {
      const raised: [string, Record<string, unknown>][] = [];
      const watch = new AccountingWatch({
        attention: {
          read: async () => ({ needsPerson: none, pending: none }),
          delayedBidInvoices: async () => none,
          waitingPayments: async () => none,
          unsettledRemainders: async () => none,
          unrefundedCreditNotes: async () => none,
          stuckRefundReversals: async () => [],
        },
        settings: switchWith(mode),
        senderModes: ["dry_run"],
        alerts: { raise: (alert, details) => void raised.push([alert.message, details]) },
        now: () => NOW,
        statusRuns: {
          lastFinishedRunAt: async () => last,
          firstStartedRunAt: async () => firstStarted,
          expectedSince,
        },
      });
      return { watch, raised };
    };
    const ago = (ms: number) => new Date(NOW.getTime() - ms);

    it("is quiet while a run finished within the last night", async () => {
      const { watch, raised } = watchWith(ago(STATUS_CHECK_MISSED_AFTER_MS - 60_000), ago(9e9));
      expect((await watch.check()).statusCheckMissed).toBe(false);
      expect(raised).toEqual([]);
    });

    it("alerts once the last run finished too long ago", async () => {
      const last = ago(STATUS_CHECK_MISSED_AFTER_MS + 60_000);
      const { watch, raised } = watchWith(last, ago(9e9));
      expect((await watch.check()).statusCheckMissed).toBe(true);
      expect(raised).toEqual([
        [
          ACCOUNTING_ALERTS.statusCheckMissed.message,
          { lastFinishedAt: last.toISOString(), modes: ["dry_run"] },
        ],
      ]);
    });

    it("a check whose runs started but never finished is told from its first run, whatever the restarts", async () => {
      // The worker restarted a minute ago; the first run started more than a night ago.
      const restarted = ago(60_000);
      expect(
        (
          await watchWith(
            null,
            restarted,
            "dry_run",
            ago(STATUS_CHECK_MISSED_AFTER_MS + 60_000),
          ).watch.check()
        ).statusCheckMissed,
      ).toBe(true);
      expect(
        (
          await watchWith(
            null,
            restarted,
            "dry_run",
            ago(STATUS_CHECK_MISSED_AFTER_MS - 60_000),
          ).watch.check()
        ).statusCheckMissed,
      ).toBe(false);
    });

    it("alerts for a check that never ran once its first night has passed, not before", async () => {
      expect(
        (await watchWith(null, ago(STATUS_CHECK_MISSED_AFTER_MS - 60_000)).watch.check())
          .statusCheckMissed,
      ).toBe(false);
      expect(
        (await watchWith(null, ago(STATUS_CHECK_MISSED_AFTER_MS + 60_000)).watch.check())
          .statusCheckMissed,
      ).toBe(true);
    });

    it("says nothing while Books is aimed at nothing", async () => {
      const { watch, raised } = watchWith(null, ago(9e9), "off");
      expect((await watch.check()).statusCheckMissed).toBe(false);
      expect(raised).toEqual([]);
    });
  });

  it("raises the refund alert for a refund's credit note issued six hours ago and not refunded in Books", async () => {
    const since = new Date(Date.parse("2031-01-01T00:00:00Z"));
    const { watch, raised, unrefundedCreditNotes } = setUp(
      {},
      "2031-01-01T12:00:00Z",
      "dry_run",
      none,
      none,
      none,
      { count: 2, oldestSince: since },
    );
    const result = await watch.check();
    expect(result.creditNoteRefundDelayed).toBe(true);
    expect(unrefundedCreditNotes).toHaveBeenCalledWith(
      ["dry_run"],
      new Date("2031-01-01T06:00:00Z"),
    );
    expect(raised).toContainEqual([
      "accounting_credit_note_refund_delayed",
      expect.objectContaining({ documentType: "credit_note", count: 2 }),
    ]);
  });
});
