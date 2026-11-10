import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import {
  UNAPPLIED_MONEY_EVENT,
  UNAPPLIED_MONEY_RESOLVED_EVENT,
  unappliedMoneyPayload,
} from "@auction/domain";
import { like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleAdminWorkItemsReader } from "./drizzle-admin-work-items.reader.js";
import { DrizzleUnappliedMoneyReader } from "./drizzle-unapplied-money.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("unapplied money reader (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzleUnappliedMoneyReader(db);
  const run = randomUUID().slice(0, 8);
  const pi = (n: string) => `pi_unapplied_${run}_${n}`;

  afterAll(async () => {
    await db.delete(domainEvent).where(like(domainEvent.aggregateId, `%${run}%`));
  });

  const received = (
    n: string,
    paymentId: string | null,
    possibleGroup?: { id: string; status: "open" | "processing" | "paid" },
  ) => {
    const payload = unappliedMoneyPayload({
      ...(possibleGroup ? { possibleGroup } : {}),
      reason: "invoice_already_paid",
      paymentId,
      paymentGroupId: null,
      stripePaymentIntentId: pi(n),
      stripeChargeId: `ch_unapplied_${run}_${n}`,
      stripeCustomerId: null,
      amountCents: 50_000,
      currency: "gbp",
    });
    return {
      aggregateType: "payment",
      aggregateId: paymentId ?? `grp-${run}-${n}`,
      eventType: UNAPPLIED_MONEY_EVENT,
      payload,
      producer: "integration-test",
    };
  };

  it("an open task is found by key and by charge, and shows in finance's inbox", async () => {
    const paymentId = `${randomUUID().slice(0, 28)}${run}`;
    await db.insert(domainEvent).values([received("open", paymentId)]);

    expect(await reader.exists(`invoice_already_paid:${pi("open")}`)).toBe(true);
    expect(await reader.exists(`invoice_already_paid:${pi("never")}`)).toBe(false);
    const byCharge = await reader.listOpenByChargeId(`ch_unapplied_${run}_open`);
    expect(byCharge.map((m) => m.dedupeKey)).toEqual([`invoice_already_paid:${pi("open")}`]);

    const items = await new DrizzleAdminWorkItemsReader(db).listUnappliedMoney(200);
    const mine = items.find((i) => i.sourceId === `invoice_already_paid:${pi("open")}`);
    expect(mine).toMatchObject({
      kind: "payment_money_unapplied",
      domain: "finance",
      href: `/admin/payments?payment=${paymentId}`,
      subtitle: "Invoice already paid · £500.00",
    });
  });

  it("puts the possible payment in the inbox hint, worded by its state, and no hint without one", async () => {
    const group = { id: "abcdef12-0000-4000-8000-000000000000", status: "paid" as const };
    await db.insert(domainEvent).values([received("hint", null, group), received("nohint", null)]);

    const items = await new DrizzleAdminWorkItemsReader(db).listUnappliedMoney(200);
    const hint = items.find((i) => i.sourceId === `invoice_already_paid:${pi("hint")}`)?.hint;
    const none = items.find((i) => i.sourceId === `invoice_already_paid:${pi("nohint")}`)?.hint;
    expect(hint).toBe("Possible overpayment of payment PG-ABCDEF12. Check before acting.");
    expect(none ?? null).toBeNull();
  });

  it("a resolved task leaves the inbox but is still known, so it is never raised again", async () => {
    const event = received("done", null);
    await db.insert(domainEvent).values([
      event,
      {
        aggregateType: "payment_group",
        aggregateId: event.aggregateId,
        eventType: UNAPPLIED_MONEY_RESOLVED_EVENT,
        payload: {
          dedupeKey: event.payload.dedupeKey,
          stripeChargeId: event.payload.stripeChargeId,
        },
        producer: "integration-test",
      },
    ]);
    expect(await reader.exists(event.payload.dedupeKey)).toBe(true);
    const open = await reader.listOpen({ limit: 500 });
    expect(open.some((m) => m.dedupeKey === event.payload.dedupeKey)).toBe(false);
    expect(await reader.listOpenByChargeId(`ch_unapplied_${run}_done`)).toEqual([]);
  });

  describe("customer balance reports", () => {
    const balance = (customer: string, n: string, currency: string) =>
      unappliedMoneyPayload({
        reason: "customer_balance_unapplied",
        paymentId: null,
        paymentGroupId: null,
        stripePaymentIntentId: null,
        stripeChargeId: null,
        stripeCustomerId: customer,
        stripeEventId: `evt_${run}_${n}:${currency}`,
        amountCents: 10_000,
        currency,
      });

    const row = (payload: ReturnType<typeof balance>, eventType: string, body: object) => ({
      aggregateType: "payment_group",
      aggregateId: `grp-${run}-${payload.dedupeKey}`,
      eventType,
      payload: body,
      producer: "integration-test",
    });

    /** The recorder's steps for a balance report: lock, find the earlier open ones, replace them. */
    const report = (payload: ReturnType<typeof balance>) =>
      db.transaction(async (tx) => {
        const t = tx as unknown as Database;
        await reader.lockKey(t, payload.dedupeKey);
        await reader.lockKey(t, `customer:${payload.stripeCustomerId}`);
        const earlier = await reader.listOpen(
          {
            reasons: ["customer_balance_unapplied"],
            stripeCustomerId: payload.stripeCustomerId as string,
            currency: payload.currency,
            limit: 50,
          },
          t,
        );
        await t.insert(domainEvent).values([
          ...earlier.map((m) =>
            row(payload, UNAPPLIED_MONEY_RESOLVED_EVENT, {
              dedupeKey: m.dedupeKey,
              via: "superseded",
            }),
          ),
          row(payload, UNAPPLIED_MONEY_EVENT, payload),
        ]);
      });

    it("filters open tasks by currency, in the caller's transaction", async () => {
      const customer = `cus_${run}_cur`;
      await report(balance(customer, "a", "gbp"));
      await report(balance(customer, "b", "eur"));
      await db.transaction(async (tx) => {
        const t = tx as unknown as Database;
        const gbp = await reader.listOpen(
          { stripeCustomerId: customer, currency: "gbp", limit: 10 },
          t,
        );
        const eur = await reader.listOpen(
          { stripeCustomerId: customer, currency: "EUR", limit: 10 },
          t,
        );
        expect(gbp.map((m) => m.currency)).toEqual(["GBP"]);
        expect(eur.map((m) => m.currency)).toEqual(["EUR"]);
      });
    });

    it("two balance reports for one customer at once leave exactly one open task", async () => {
      const customer = `cus_${run}_race`;
      await Promise.all([
        report(balance(customer, "x", "gbp")),
        report(balance(customer, "y", "gbp")),
      ]);
      const open = await reader.listOpen({ stripeCustomerId: customer, limit: 10 });
      expect(open).toHaveLength(1);
    });
  });
});
