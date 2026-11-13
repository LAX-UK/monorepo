import { BUDGET_WARNING_EVENT } from "@auction/accounting-zoho-books";
import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNTING_ALERTS,
  ACCOUNTING_CRON_MONITORS,
  booksLoggerWithAlerts,
  createAccountingAlertSink,
} from "./accounting-alerts.js";

describe("accounting alerts", () => {
  it("logs each alert at its level and sends it to Sentry under its message", () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    const capture = vi.fn();
    const sink = createAccountingAlertSink(log, capture);
    sink.raise(ACCOUNTING_ALERTS.needsPersonOverdue, { count: 2 });
    sink.raise(ACCOUNTING_ALERTS.senderMissed, { count: 5 });
    expect(log.warn).toHaveBeenCalledWith({ count: 2 }, "accounting_needs_person_overdue");
    expect(log.error).toHaveBeenCalledWith({ count: 5 }, "accounting_sender_missed");
    expect(capture).toHaveBeenCalledWith("accounting_needs_person_overdue", {
      level: "warning",
      extra: { count: 2 },
    });
    expect(capture).toHaveBeenCalledWith("accounting_sender_missed", {
      level: "error",
      extra: { count: 5 },
    });
  });

  it("raises the Books client's budget warning and circuit events, and only those", () => {
    // The worker names the client's event without importing the client into app code.
    expect(ACCOUNTING_ALERTS.budgetPastWarning.message).toBe(BUDGET_WARNING_EVENT);
    const base = { log: vi.fn() };
    const raise = vi.fn();
    const logger = booksLoggerWithAlerts(base, { raise });
    logger.log("warn", BUDGET_WARNING_EVENT, { used: 801, limit: 1000 });
    logger.log("error", "zoho_books.circuit_open", { organizationId: "1" });
    logger.log("info", "zoho_books.call", { status: 200 });
    expect(base.log).toHaveBeenCalledTimes(3);
    expect(raise.mock.calls.map(([alert]) => alert.message)).toEqual([
      "zoho_books.budget_past_warning",
      "zoho_books.circuit_open",
    ]);
  });

  it("names a distinct message for every alert and a key for every accounting cron", () => {
    const messages = Object.values(ACCOUNTING_ALERTS).map((alert) => alert.message);
    expect(new Set(messages).size).toBe(messages.length);
    expect(ACCOUNTING_CRON_MONITORS).toEqual({
      watch: "accounting-watch",
      sender: "accounting-sender",
      reconcile: "accounting-reconcile",
    });
  });
});
