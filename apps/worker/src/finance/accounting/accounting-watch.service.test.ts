import { INVOICE_DELAYED_AFTER_MS, ok, refuse } from "@auction/accounting-domain";
import type {
  AccountingAttention,
  IAccountingSourceSettingReader,
  QueueAge,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { ACCOUNTING_ALERTS, type AccountingAlertSink } from "./accounting-alerts.js";
import { AccountingWatch, SENDER_MISSED_AFTER_MS } from "./accounting-watch.service.js";

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
) {
  const raised: [string, Record<string, unknown>][] = [];
  const alerts: AccountingAlertSink = {
    raise: (alert, details) => void raised.push([alert.message, details]),
  };
  const read = vi.fn(async () => ({ needsPerson: none, pending: none, ...attention }));
  const delayedBidInvoices = vi.fn(async () => delayed);
  const watch = new AccountingWatch({
    attention: { read, delayedBidInvoices },
    settings: switchWith(mode),
    senderModes: ["dry_run"],
    alerts,
    now: () => new Date(now),
  });
  return { watch, raised, read, delayedBidInvoices };
}

describe("AccountingWatch", () => {
  it("raises nothing when the queue is quiet", async () => {
    const { watch, raised } = setUp({}, "2026-11-13T12:00:00Z");
    expect(await watch.check()).toEqual({
      needsPersonOverdue: false,
      senderMissed: false,
      bidInvoiceDelayed: false,
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
      attention: { read, delayedBidInvoices: vi.fn(async () => none) },
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
});
