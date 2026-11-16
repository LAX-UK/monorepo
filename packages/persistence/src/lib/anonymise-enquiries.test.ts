import { ERASED_ENQUIRY } from "@auction/domain";
import { type SQL, getTableName } from "drizzle-orm";
import { PgDialect, type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { anonymiseEnquiries } from "./anonymise-enquiries.js";

type Row = Record<string, unknown>;

/**
 * A transaction that answers by call order: the first select returns the matched enquiries, each
 * delete/update returns the next queued result, and every `set` payload is recorded.
 */
function fakeTx(input: {
  matched: Array<{ id: string; status: string; createdAt?: Date }>;
  /** The deals made from the converted enquiries, answered to the second select. */
  deals?: Array<{
    id?: string;
    enquiryId: string;
    stage: string;
    agreedAt?: Date | null;
    cancelledAt?: Date | null;
    createdAt?: Date;
  }>;
  /** The people acting for each deal's two sides. */
  parties?: Array<{ dealId: string; userId: string | null }>;
  /** Everyone ever named on a deal, from its party history, including a buyer later replaced. */
  named?: Array<{ dealId: string; userId: string | null }>;
  /** When each deal settled, from its stage history. */
  settled?: Array<{ dealId: string; at: Date }>;
  /** Screenings and source-of-funds cases opened for those people. */
  screenings?: Array<{ userId: string; at: Date }>;
  funds?: Array<{ userId: string; at: Date }>;
  /** Holds still in place, accounts whose identity check was rejected, declined decisions (Veriff 9102) and screening decisions. */
  holds?: Array<{ userId: string; at: Date }>;
  rejected?: Array<{ userId: string; at: Date }>;
  declined?: Array<{ userId: string; at: Date }>;
  decisions?: Array<{ userId: string; at: Date }>;
  detached?: Row[];
  notes?: Row[];
  enquiries?: Row[];
  /** Held mail rows each quarantine delete returns. */
  heldMail?: Row[];
}) {
  const sets: Row[] = [];
  const updateResults: Row[][] = [
    ...(input.detached?.length ? [[]] : []), // upload expiry update returns nothing used
    input.notes ?? [],
    [], // the sender's emailed replies
    [], // private sale detail
    input.enquiries ?? [],
  ];
  const deleteResult = input.detached ?? [];
  /** Every delete, as the table it targets and the SQL of its condition. */
  const deletes: Array<{ table: string; sql: string; params: unknown[] }> = [];
  const dialect = new PgDialect();
  /** Every change to the event log, as the SQL of its new payload and of its condition. */
  const eventUpdates: Array<{ set: string; where: string; params: unknown[] }> = [];
  const update = vi.fn((table: PgTable) => ({
    set: (values: Row) => {
      if (getTableName(table) === "domain_events") {
        return {
          where: (condition: SQL) => {
            const where = dialect.sqlToQuery(condition);
            eventUpdates.push({
              set: dialect.sqlToQuery(values.payload as SQL).sql,
              where: where.sql,
              params: where.params,
            });
            return Object.assign(Promise.resolve([]), { returning: () => Promise.resolve([]) });
          },
        };
      }
      sets.push(values);
      const result = updateResults.shift() ?? [];
      const chain = {
        where: () =>
          Object.assign(Promise.resolve(result), { returning: () => Promise.resolve(result) }),
      };
      return chain;
    },
  }));
  const del = vi.fn((table: PgTable) => ({
    where: (condition: SQL) => {
      const query = dialect.sqlToQuery(condition);
      deletes.push({ table: getTableName(table), sql: query.sql, params: query.params });
      const result =
        getTableName(table) === "enquiry_inbound_quarantine"
          ? (input.heldMail ?? [])
          : deleteResult;
      return Object.assign(Promise.resolve(result), {
        returning: () => Promise.resolve(result),
      });
    },
  }));
  // Answered by call order: the enquiries, the deals, then (when there are deals) their parties,
  // the people named, settlements, then screenings, source-of-funds cases, holds, rejected
  // accounts, declined decisions and screening decisions.
  const answers = [
    input.matched,
    (input.deals ?? []).map((d) => ({ id: "d1", ...d })),
    input.parties ?? [],
    input.named ?? [],
    (input.settled ?? []).map((row) => ({ toStage: "settled", ...row })),
    input.screenings ?? [],
    input.funds ?? [],
    input.holds ?? [],
    input.rejected ?? [],
    input.declined ?? [],
    input.decisions ?? [],
  ];
  const select = vi.fn(() => ({
    from: () => ({
      where: () => {
        const result = Promise.resolve(answers.shift() ?? []);
        // The enquiries are read under a row lock.
        return Object.assign(result, { for: () => result });
      },
    }),
  }));
  return {
    tx: { select, update, delete: del } as never,
    sets,
    update,
    del,
    deletes,
    eventUpdates,
  };
}

describe("anonymiseEnquiries", () => {
  it("replaces the sender details and clears the phone, and reports what changed", async () => {
    const { tx, sets } = fakeTx({
      matched: [{ id: "e1", status: "new" }],
      notes: [{ id: "n1" }],
      enquiries: [{ id: "e1" }],
    });
    const counts = await anonymiseEnquiries(tx, { kind: "email", email: "Ada@x.com" });
    expect(counts).toEqual({ enquiries: 1, notes: 1, attachments: 0, held: 0 });
    const enquirySet = sets.find((s) => "message" in s);
    expect(enquirySet).toMatchObject({
      name: ERASED_ENQUIRY.name,
      email: ERASED_ENQUIRY.email,
      phone: null,
      message: ERASED_ENQUIRY.message,
    });
    expect(sets.find((s) => "body" in s)).toEqual({ body: ERASED_ENQUIRY.note });
    // Reference, intent, department, status and routing are never in a change.
    for (const key of ["reference", "intent", "status", "departmentSlug", "assignedToUserId"]) {
      expect(enquirySet).not.toHaveProperty(key);
    }
  });

  it("detaches files and expires their records so the clean-up deletes them", async () => {
    const { tx, sets, del } = fakeTx({
      matched: [{ id: "e1", status: "in_progress" }],
      detached: [{ uploadObjectId: "u1" }, { uploadObjectId: "u2" }],
      enquiries: [{ id: "e1" }],
    });
    const counts = await anonymiseEnquiries(tx, { kind: "accounts", userIds: ["user_1"] });
    expect(counts.attachments).toBe(2);
    // The file detach and the quarantined mail suspected to belong to the enquiry.
    expect(del).toHaveBeenCalledTimes(2);
    expect(sets.some((s) => "expiresAt" in s)).toBe(true);
  });

  it("deletes quarantined mail suspected to belong to an erased enquiry, for an account target too", async () => {
    const { tx, deletes } = fakeTx({
      matched: [{ id: "e1", status: "new" }],
      enquiries: [{ id: "e1" }],
    });
    await anonymiseEnquiries(tx, { kind: "accounts", userIds: ["user_1"] });
    const quarantine = deletes.filter((d) => d.table === "enquiry_inbound_quarantine");
    // Exactly one delete on the quarantine, by the erased enquiry's id; no address match for an
    // account target (the account's address is not what the mail was sent from).
    expect(quarantine).toHaveLength(1);
    expect(quarantine[0]?.sql).toBe('"enquiry_inbound_quarantine"."suspected_enquiry_id" in ($1)');
    expect(quarantine[0]?.params).toEqual(["e1"]);
  });

  it("deletes quarantined mail by suspected enquiry and by sender address for an email target", async () => {
    const { tx, deletes } = fakeTx({
      matched: [
        { id: "e1", status: "new" },
        { id: "e2", status: "in_progress" },
      ],
      enquiries: [{ id: "e1" }, { id: "e2" }],
    });
    await anonymiseEnquiries(tx, { kind: "email", email: "  Ada@Example.com " });
    const quarantine = deletes.filter((d) => d.table === "enquiry_inbound_quarantine");
    expect(quarantine.map((d) => [d.sql, d.params])).toEqual([
      ['lower("enquiry_inbound_quarantine"."from_address") = $1', ["ada@example.com"]],
      ['"enquiry_inbound_quarantine"."suspected_enquiry_id" in ($1, $2)', ["e1", "e2"]],
    ]);
  });

  it("deletes held mail from the erased address even when no enquiry can be erased", async () => {
    const none = fakeTx({ matched: [] });
    await anonymiseEnquiries(none.tx, { kind: "email", email: "ada@example.com" });
    expect(
      none.deletes
        .filter((d) => d.table === "enquiry_inbound_quarantine")
        .map((d) => [d.sql, d.params]),
    ).toEqual([['lower("enquiry_inbound_quarantine"."from_address") = $1', ["ada@example.com"]]]);

    const held = fakeTx({ matched: [{ id: "e1", status: "converted" }] });
    await anonymiseEnquiries(held.tx, { kind: "email", email: "ada@example.com" });
    expect(held.deletes.filter((d) => d.table === "enquiry_inbound_quarantine")).toHaveLength(1);
  });

  it("replaces the reason staff typed in the attach and discard events of the erased mail", async () => {
    const { tx, eventUpdates } = fakeTx({
      matched: [{ id: "e1", status: "new" }],
      enquiries: [{ id: "e1" }],
      heldMail: [{ id: "q1" }],
    });
    await anonymiseEnquiries(tx, { kind: "email", email: "ada@example.com" });
    // Once for the held mail from the address, once for the erased enquiry and its suspected mail.
    expect(eventUpdates).toHaveLength(2);
    for (const change of eventUpdates) {
      // Only the reason's value is replaced; the rest of the payload stays as it was.
      expect(change.set).toBe(
        `jsonb_set("domain_events"."payload", '{reviewReason}', to_jsonb($1::text))`,
      );
      expect(change.where).toContain('"domain_events"."event_type" = $');
      // An event already scrubbed, or with no reason, is not rewritten.
      expect(change.where).toContain(
        `jsonb_typeof("domain_events"."payload"->'reviewReason') = 'string'`,
      );
      expect(change.where).toContain(`"domain_events"."payload"->>'reviewReason' <> $`);
      expect(change.params).toContain(ERASED_ENQUIRY.note);
    }
    const [byAddress, byEnquiry] = eventUpdates;
    expect(byAddress?.params).toEqual(
      expect.arrayContaining([
        "marketing_enquiry.inbound_attached",
        "marketing_enquiry.inbound_discarded",
        "enquiry_inbound_quarantine",
        "q1",
      ]),
    );
    expect(byAddress?.params).not.toContain("e1");
    expect(byEnquiry?.params).toEqual(
      expect.arrayContaining([
        "marketing_enquiry.inbound_attached",
        "marketing_enquiry",
        "e1",
        "q1",
      ]),
    );
  });

  it("leaves the event log alone when nothing was erased", async () => {
    const { tx, eventUpdates } = fakeTx({ matched: [{ id: "e1", status: "converted" }] });
    await anonymiseEnquiries(tx, { kind: "email", email: "ada@example.com" });
    expect(eventUpdates).toEqual([]);
  });

  it("holds a converted enquiry: nothing is changed and it is counted", async () => {
    const { tx, update, del } = fakeTx({ matched: [{ id: "e1", status: "converted" }] });
    const counts = await anonymiseEnquiries(tx, { kind: "accounts", userIds: ["user_1"] });
    expect(counts).toEqual({
      enquiries: 0,
      notes: 0,
      attachments: 0,
      held: 1,
      hold: { until: null, withoutEnd: true },
    });
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("erases the open enquiries and holds the converted one in the same run", async () => {
    const { tx } = fakeTx({
      matched: [
        { id: "e1", status: "closed" },
        { id: "e2", status: "converted" },
      ],
      enquiries: [{ id: "e1" }],
    });
    const counts = await anonymiseEnquiries(tx, { kind: "email", email: "a@b.co" });
    expect(counts).toMatchObject({ enquiries: 1, held: 1 });
  });

  it("does nothing for no accounts, and counts nothing the second time", async () => {
    const none = fakeTx({ matched: [] });
    expect(await anonymiseEnquiries(none.tx, { kind: "accounts", userIds: [] })).toEqual({
      enquiries: 0,
      notes: 0,
      attachments: 0,
      held: 0,
    });
    expect(none.tx.select).not.toHaveBeenCalled;
    const again = fakeTx({ matched: [{ id: "e1", status: "new" }], enquiries: [], notes: [] });
    expect(await anonymiseEnquiries(again.tx, { kind: "email", email: "a@b.co" })).toEqual({
      enquiries: 0,
      notes: 0,
      attachments: 0,
      held: 0,
    });
  });

  describe("a converted enquiry and the record of its deal", () => {
    const enquiryOpened = new Date("2026-01-01T00:00:00Z");
    const converted = [{ id: "e1", status: "converted", createdAt: enquiryOpened }];
    const NOW = new Date("2026-11-08T12:00:00Z");
    const run = (input: Parameters<typeof fakeTx>[0], retentionYears?: number) => {
      const { tx, update, sets } = fakeTx({ ...input, enquiries: [{ id: "e1" }] });
      return anonymiseEnquiries(
        tx,
        { kind: "email", email: "a@b.co" },
        { now: NOW, ...(retentionYears ? { retentionYears } : {}) },
      ).then((counts) => ({ counts, update, sets }));
    };
    const created = new Date("2026-01-20T00:00:00Z");
    const settledDeal = {
      enquiryId: "e1",
      stage: "settled",
      agreedAt: new Date("2026-02-01T00:00:00Z"),
      createdAt: created,
    };

    it.each(["proposed", "offer", "agreed", "invoiced", "paid", "released"])(
      "is held while its deal is %s",
      async (stage) => {
        const { counts, update } = await run({
          matched: converted,
          deals: [{ enquiryId: "e1", stage, createdAt: created }],
        });
        expect(counts).toEqual({
          enquiries: 0,
          notes: 0,
          attachments: 0,
          held: 1,
          hold: { until: null, withoutEnd: false },
        });
        expect(update).not.toHaveBeenCalled();
      },
    );

    it("is held once the deal has settled, within the five years", async () => {
      const { counts, update } = await run({
        matched: converted,
        deals: [settledDeal],
        settled: [{ dealId: "d1", at: new Date("2026-03-01T00:00:00Z") }],
      });
      expect(counts.held).toBe(1);
      expect(counts.hold).toEqual({ until: new Date("2031-03-01T00:00:00Z"), withoutEnd: false });
      expect(update).not.toHaveBeenCalled();
    });

    it("is erased once the five years since settlement have passed", async () => {
      const { counts, sets } = await run({
        matched: converted,
        deals: [settledDeal],
        settled: [{ dealId: "d1", at: new Date("2021-03-01T00:00:00Z") }],
      });
      expect(counts).toMatchObject({ enquiries: 1, held: 0 });
      expect(sets.find((s) => "message" in s)).toMatchObject({ name: ERASED_ENQUIRY.name });
    });

    it("keeps the record as long as the configured retention says", async () => {
      const input = {
        matched: converted,
        deals: [settledDeal],
        settled: [{ dealId: "d1", at: new Date("2021-03-01T00:00:00Z") }],
      };
      expect((await run(input, 10)).counts.held).toBe(1);
      expect((await run(input, 3)).counts.held).toBe(0);
    });

    it("ends a settled deal with no settle row on its own last write, not never", async () => {
      const lastWrite = (at: string) => ({ ...settledDeal, updatedAt: new Date(at) });
      const recent = await run({ matched: converted, deals: [lastWrite("2026-03-01T00:00:00Z")] });
      expect(recent.counts.held).toBe(1);
      const old = await run({ matched: converted, deals: [lastWrite("2021-03-01T00:00:00Z")] });
      expect(old.counts).toMatchObject({ enquiries: 1, held: 0 });
    });

    it("is held, and said to have no end, when a settled deal carries no date at all", async () => {
      const { counts } = await run({ matched: converted, deals: [settledDeal] });
      expect(counts.held).toBe(1);
      expect(counts.hold).toEqual({ until: null, withoutEnd: true });
    });

    const cancelled = (agreedAt: Date | null) => ({
      enquiryId: "e1",
      stage: "cancelled",
      agreedAt,
      cancelledAt: new Date("2026-04-01T00:00:00Z"),
      createdAt: created,
    });
    const parties = [
      { dealId: "d1", userId: "u-seller" },
      { dealId: "d1", userId: "u-buyer" },
    ];

    it("is erased when the deal was cancelled before agreement and no check was opened", async () => {
      const { counts } = await run({ matched: converted, deals: [cancelled(null)], parties });
      expect(counts).toMatchObject({ enquiries: 1, held: 0 });
    });

    it("is held when the deal was cancelled after agreement", async () => {
      const { counts } = await run({
        matched: converted,
        deals: [cancelled(new Date("2026-02-01T00:00:00Z"))],
        parties,
      });
      expect(counts.held).toBe(1);
    });

    it.each([
      [
        "a screening",
        { screenings: [{ userId: "u-buyer", at: new Date("2026-02-15T00:00:00Z") }] },
      ],
      [
        "a source-of-funds case",
        { funds: [{ userId: "u-seller", at: new Date("2026-02-15T00:00:00Z") }] },
      ],
    ])("is held when the deal was cancelled before agreement but had %s", async (_why, checks) => {
      const { counts } = await run({
        matched: converted,
        deals: [cancelled(null)],
        parties,
        ...checks,
      });
      expect(counts.held).toBe(1);
    });

    it("ignores a check from before the enquiry arrived", async () => {
      const { counts } = await run({
        matched: converted,
        deals: [cancelled(null)],
        parties,
        screenings: [{ userId: "u-buyer", at: new Date("2025-06-01T00:00:00Z") }],
      });
      expect(counts).toMatchObject({ enquiries: 1, held: 0 });
    });

    it("is held when a check was opened between the enquiry and the deal", async () => {
      const { counts } = await run({
        matched: converted,
        deals: [cancelled(null)],
        parties,
        screenings: [{ userId: "u-buyer", at: new Date("2026-01-10T00:00:00Z") }],
      });
      expect(counts.held).toBe(1);
    });

    it("is held when a buyer screened and then replaced is no longer a current party", async () => {
      const { counts } = await run({
        matched: converted,
        deals: [cancelled(null)],
        parties,
        named: [{ dealId: "d1", userId: "u-first-buyer" }],
        screenings: [{ userId: "u-first-buyer", at: new Date("2026-02-15T00:00:00Z") }],
      });
      expect(counts.held).toBe(1);
    });

    it.each([
      [
        "an anti-money-laundering hold",
        { holds: [{ userId: "u-buyer", at: new Date("2026-02-15T00:00:00Z") }] },
      ],
      [
        "a rejected identity check",
        { rejected: [{ userId: "u-buyer", at: new Date("2026-02-15T00:00:00Z") }] },
      ],
      [
        "a declined Veriff decision",
        { declined: [{ userId: "u-buyer", at: new Date("2026-02-15T00:00:00Z") }] },
      ],
      [
        "an AML hold that was cleared before the request",
        { decisions: [{ userId: "u-buyer", at: new Date("2026-02-15T00:00:00Z") }] },
      ],
    ])("is held when the deal was cancelled before agreement but had %s", async (_why, checks) => {
      const { counts } = await run({
        matched: converted,
        deals: [cancelled(null)],
        parties,
        ...checks,
      });
      expect(counts.held).toBe(1);
    });

    it("ignores a check opened for someone who is not a party", async () => {
      const { counts } = await run({
        matched: converted,
        deals: [cancelled(null)],
        parties,
        screenings: [{ userId: "u-stranger", at: new Date("2026-02-15T00:00:00Z") }],
      });
      expect(counts.held).toBe(0);
    });

    it("is erased once the retention has run after a cancellation that had to be kept", async () => {
      const old = {
        ...cancelled(new Date("2020-02-01T00:00:00Z")),
        cancelledAt: new Date("2020-04-01T00:00:00Z"),
      };
      const { counts } = await run({ matched: converted, deals: [old], parties });
      expect(counts).toMatchObject({ enquiries: 1, held: 0 });
    });

    it("is held when it has no deal at all", async () => {
      const { counts, update } = await run({ matched: converted });
      expect(counts.held).toBe(1);
      expect(update).not.toHaveBeenCalled();
    });

    it("asks for deals only when something is converted", async () => {
      const { tx } = fakeTx({
        matched: [{ id: "e1", status: "new" }],
        enquiries: [{ id: "e1" }],
      });
      await anonymiseEnquiries(tx, { kind: "email", email: "a@b.co" });
      expect(tx.select).toHaveBeenCalledTimes(1);
    });
  });
});
