import {
  type CreditNote,
  type Invoice,
  type LineInput,
  VAT_TREATMENTS,
  buildCreditNoteFor,
  buildInvoice,
  laxReference,
  vatInsideGross,
} from "@auction/accounting-domain";
import { describe, expect, it } from "vitest";
import { booksLineVat } from "./common.js";

const GOODS: LineInput = {
  description: "Print",
  quantity: 1,
  unitNetPence: 0,
  treatment: "standard",
  role: "goods",
};

const BUYER = laxReference("bid", "contact", "buyer-1");

function invoiceOf(netPence: number): Invoice {
  if (!BUYER.ok) throw new Error(BUYER.refusal.message);
  const built = buildInvoice({
    product: "bid",
    sourceId: `inv-${netPence}`,
    contactReference: BUYER.value,
    issuedOn: "2026-11-12",
    dueOn: "2026-11-26",
    lines: [{ ...GOODS, unitNetPence: netPence }],
  });
  if (!built.ok) throw new Error(built.refusal.message);
  return built.value;
}

/** Credit `takes` of the invoice's goods one note at a time, as a run of partial refunds would. */
function creditInTurn(invoice: Invoice, takes: readonly number[]): CreditNote[] {
  const gross = invoice.totals.grossPence;
  const notes: CreditNote[] = [];
  let refunded = 0;
  for (const [i, take] of takes.entries()) {
    const built = buildCreditNoteFor(invoice, {
      sourceId: `cn-${i}`,
      issuedOn: "2026-11-13",
      buckets: {
        paidGoodsPence: gross,
        paidDeliveryPence: 0,
        refundedGoodsPence: refunded,
        refundedDeliveryPence: 0,
      },
      request: { goodsPence: take, deliveryPence: 0 },
      priorCredits: notes,
    });
    if (!built.ok) throw new Error(built.refusal.message);
    notes.push(built.value);
    refunded += take;
  }
  return notes;
}

/** Lines whose VAT Books would work out differently from the VAT LAX stated. */
function differing(notes: readonly CreditNote[]): string[] {
  return notes.flatMap((note) =>
    note.lines
      .filter((line) => booksLineVat(line) !== line.vatPence)
      .map(
        (line) =>
          `${note.reference}: ${line.unitNetPence + line.vatPence}p gross, VAT ours ${line.vatPence}p, Books ${booksLineVat(line)}p`,
      ),
  );
}

/** Small deterministic PRNG (mulberry32), so a failure always reproduces. */
function prng(seed: number): (max: number) => number {
  let a = seed;
  return (max) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

/**
 * Whether `gross` can be sent as whole-pence tax-inclusive lines whose VAT, as Books works it out
 * per line, adds up to `vat`. When it cannot, no allocation could match Books and the note is
 * refused for staff.
 */
function representable(gross: number, vat: number): boolean {
  // reach[g] = the VAT totals that `g` gross can be split into.
  const reach: Set<number>[] = [new Set([0])];
  for (let g = 1; g <= gross; g++) {
    const out = new Set<number>();
    for (let part = 1; part <= g; part++) {
      for (const v of reach[g - part] ?? []) out.add(v + vatInsideGross(part, "standard"));
    }
    reach.push(out);
  }
  return reach[gross]?.has(vat) ?? false;
}

describe("partial credit notes: every line's VAT is what Books works out", () => {
  it("one partial credit then the rest, on every line up to £3 net, every gross: to the penny", () => {
    const off: string[] = [];
    let impossible = 0;
    for (let net = 1; net <= 300; net++) {
      const invoice = invoiceOf(net);
      const gross = invoice.totals.grossPence;
      for (let take = 1; take < gross; take++) {
        const notes = creditInTurn(invoice, [take, gross - take]);
        expect(notes.reduce((sum, n) => sum + n.totals.vatPence, 0)).toBe(invoice.totals.vatPence);
        for (const line of differing(notes)) {
          const rest = notes[1];
          // Only a rest no split of whole pence can carry is left as it is (and refused).
          if (rest && !representable(rest.totals.grossPence, rest.totals.vatPence)) impossible++;
          else off.push(line);
        }
      }
    }
    expect(off).toEqual([]);
    // 60 of 53,880 runs: a 2p rest left carrying 1p VAT, which Books never computes.
    expect(impossible).toBe(60);
  });

  it("random runs of up to two partial credits, then the rest, on lines up to £5,000: to the penny", () => {
    const random = prng(20261118);
    for (let run = 0; run < 3_000; run++) {
      const invoice = invoiceOf(1 + random(500_000));
      const gross = invoice.totals.grossPence;
      const takes: number[] = [];
      let left = gross;
      for (let i = 0, parts = 1 + random(2); i < parts && left > 1; i++) {
        const take = 1 + random(left - 1);
        takes.push(take);
        left -= take;
      }
      if (random(2) === 0) takes.push(left);
      const notes = creditInTurn(invoice, takes);
      expect(differing(notes)).toEqual([]);
      const vat = notes.reduce((sum, n) => sum + n.totals.vatPence, 0);
      if (takes.reduce((s, t) => s + t, 0) === gross) expect(vat).toBe(invoice.totals.vatPence);
      else expect(vat).toBeLessThanOrEqual(invoice.totals.vatPence);
    }
  });

  it("long runs of partial credits: every credit that leaves part of the line is to the penny", () => {
    const random = prng(1118);
    for (let run = 0; run < 2_000; run++) {
      const invoice = invoiceOf(1 + random(500_000));
      const gross = invoice.totals.grossPence;
      const takes: number[] = [];
      let left = gross;
      for (let i = 0, parts = 1 + random(8); i < parts && left > 1; i++) {
        const take = 1 + random(Math.min(left - 1, 1 + random(left)));
        takes.push(take);
        left -= take;
      }
      takes.push(left);
      const notes = creditInTurn(invoice, takes);
      expect(differing(notes.slice(0, -1))).toEqual([]);
      expect(notes.reduce((sum, n) => sum + n.totals.vatPence, 0)).toBe(invoice.totals.vatPence);
    }
  });
});

describe("partial credit notes on invoices of several lines and treatments (review N5)", () => {
  /** 2 to 4 lines, goods and delivery, every treatment, descriptions reused on purpose. */
  function mixedInvoice(random: (max: number) => number, run: number): Invoice {
    if (!BUYER.ok) throw new Error(BUYER.refusal.message);
    const count = 2 + random(3);
    const lines: LineInput[] = Array.from({ length: count }, (_, i) => ({
      description: random(2) === 0 ? "Print" : `Print ${i}`,
      quantity: 1,
      unitNetPence: 1 + random(i === 0 ? 300 : 50_000),
      treatment: VAT_TREATMENTS[random(VAT_TREATMENTS.length)] as LineInput["treatment"],
      role: random(4) === 0 ? "delivery" : "goods",
    }));
    const built = buildInvoice({
      product: "bid",
      sourceId: `mixed-${run}`,
      contactReference: BUYER.value,
      issuedOn: "2026-11-12",
      dueOn: "2026-11-26",
      lines,
    });
    if (!built.ok) throw new Error(built.refusal.message);
    return built.value;
  }

  it("two partial credits then the rest: every line is what Books works out, the totals exactly the invoice's", () => {
    const random = prng(1566);
    for (let run = 0; run < 1_500; run++) {
      const invoice = mixedInvoice(random, run);
      const role = (r: "goods" | "delivery") =>
        invoice.lines
          .filter((l) => l.role === r)
          .reduce((sum, l) => sum + l.unitNetPence * l.quantity + l.vatPence, 0);
      const paid = { goods: role("goods"), delivery: role("delivery") };
      const notes: CreditNote[] = [];
      const refunded = { goods: 0, delivery: 0 };
      for (let step = 0; step < 3; step++) {
        const last = step === 2;
        const take = (r: "goods" | "delivery") => {
          const left = paid[r] - refunded[r];
          return last || left === 0 ? left : 1 + random(left);
        };
        const request = { goodsPence: take("goods"), deliveryPence: take("delivery") };
        if (request.goodsPence + request.deliveryPence === 0) continue;
        const built = buildCreditNoteFor(invoice, {
          sourceId: `cn-${run}-${step}`,
          issuedOn: "2026-11-13",
          buckets: {
            paidGoodsPence: paid.goods,
            paidDeliveryPence: paid.delivery,
            refundedGoodsPence: refunded.goods,
            refundedDeliveryPence: refunded.delivery,
          },
          request,
          priorCredits: notes,
        });
        if (!built.ok) throw new Error(`run ${run}: ${built.refusal.message}`);
        expect(built.value.creditVatRule).toBe("books");
        notes.push(built.value);
        refunded.goods += request.goodsPence;
        refunded.delivery += request.deliveryPence;
      }
      // Lines that carry no VAT never differ; a standard line differs only where no whole-pence
      // split of its rest can carry the VAT left (checked exhaustively above), so none here.
      for (const note of notes) {
        for (const line of note.lines) {
          if (line.treatment !== "standard") expect(line.vatPence).toBe(0);
        }
      }
      const diffs = differing(notes).filter((d) => {
        const m = /: (\d+)p gross, VAT ours (\d+)p/.exec(d);
        return !m || representable(Number(m[1]), Number(m[2]));
      });
      expect(diffs).toEqual([]);
      const sum = (k: "netPence" | "vatPence" | "grossPence") =>
        notes.reduce((n, c) => n + c.totals[k], 0);
      expect([sum("netPence"), sum("vatPence"), sum("grossPence")]).toEqual([
        invoice.totals.netPence,
        invoice.totals.vatPence,
        invoice.totals.grossPence,
      ]);
    }
  });
});
