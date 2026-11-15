import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../../crm/crm-gateway-error.js";
import { framing, orderFacts, printLine } from "./order-facts.fixture.js";
import type { OrderFulfilmentFacts, RunSales } from "./order-facts.js";
import { OrderMirror } from "./order-mirror.js";
import type { ZohoFields, ZohoRecordState } from "./plan-order.js";
import type { OrderModule, ZohoOrderRecords } from "./zoho-order-modules.js";

const GROUP = "LAX-PRT-MP-GAC-26-0037";
const SKU = `${GROUP}-A3-HAH-UNF-COL`;
const FIELDS = {
  orderRef: "LAX_Order_Ref",
  framingSpec: "LAX_Framing_Spec",
  dispatchPrints: "LAX_Prints",
};

type Row = { id: string; module: OrderModule; fields: Record<string, unknown> };

/**
 * Zoho as the mirror sees it: records found by a key field, updated by id, and a new record
 * upserted on its key field, so one made meanwhile is updated.
 */
function fakeZoho(seed: Row[] = []) {
  const rows = [...seed];
  const saves: Save[] = [];
  const finds: string[] = [];
  const zoho: ZohoOrderRecords = {
    async find(module, keyField, key, columns): Promise<ZohoRecordState | null> {
      finds.push(`${module}:${key}`);
      const row = rows.find((r) => r.module === module && r.fields[keyField] === key);
      if (!row) return null;
      return { id: row.id, fields: Object.fromEntries(columns.map((c) => [c, row.fields[c]])) };
    },
    async save(module, id, fields, matchOn) {
      saves.push({ module, id, fields, matchOn });
      const flat = Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, typeof v === "object" && v ? v.id : v]),
      );
      const row = id
        ? rows.find((r) => r.id === id)
        : matchOn
          ? rows.find((r) => r.module === module && r.fields[matchOn] === flat[matchOn])
          : undefined;
      if (row) {
        Object.assign(row.fields, flat);
        return row.id;
      }
      const created = { id: `${module}-${rows.length + 1}`, module, fields: flat };
      rows.push(created);
      return created.id;
    },
  };
  return { zoho, rows, saves, finds };
}

const GROUP_ROWS: Row[] = [
  { id: "pp-1", module: "Print_Products", fields: { Print_Group_ID: GROUP } },
  { id: "led-1", module: "Edition_Ledgers", fields: { LAX_Mirror_Key: `group:${GROUP}` } },
];

const ORIGINAL = {
  id: "reg-orig",
  zohoProductId: "zp-orig",
  stockCode: "LAX-ORI-MP-GAC-26-0037",
  kind: "original",
} as ArtworkRegisterEntry;

function build(input: {
  facts?: OrderFulfilmentFacts | null;
  rows?: Row[];
  mode?: "dry_run" | "live";
  register?: ArtworkRegisterEntry | null;
  sales?: RunSales;
  reportProblems?: boolean;
}) {
  const z = fakeZoho(input.rows ?? GROUP_ROWS);
  const log = { info: vi.fn(), warn: vi.fn() };
  const runSales = vi.fn().mockResolvedValue(input.sales ?? { collector: 3, artist: 1, lax: 0 });
  const findByZohoProductId = vi
    .fn()
    .mockResolvedValue(input.register === undefined ? ORIGINAL : input.register);
  const mirror = new OrderMirror({
    facts: {
      read: vi.fn().mockResolvedValue(input.facts === undefined ? orderFacts() : input.facts),
      runSales,
    },
    register: { findByZohoProductId },
    zoho: z.zoho,
    fields: FIELDS,
    mode: input.mode ?? "live",
    log,
  });
  return { ...z, mirror, log, runSales, findByZohoProductId };
}

type Save = {
  module: OrderModule;
  id: string | null;
  fields: ZohoFields;
  matchOn?: string | undefined;
};

const byModule = (saves: Save[], module: OrderModule) => saves.filter((s) => s.module === module);

describe("OrderMirror", () => {
  it("skips an order that is missing, unpaid or has no prints", async () => {
    expect(await build({ facts: null }).mirror.deliver("o")).toEqual({
      outcome: "skipped",
      reason: "order_not_found",
    });
    expect(await build({ facts: orderFacts({ paid: false }) }).mirror.deliver("o")).toEqual({
      outcome: "skipped",
      reason: "order_not_paid",
    });
    expect(await build({ facts: orderFacts({ prints: [] }) }).mirror.deliver("o")).toEqual({
      outcome: "skipped",
      reason: "no_prints_on_order",
    });
  });

  it("creates the Print SKU linked to its group and counts the run's sold prints on the ledger", async () => {
    const m = build({});
    expect(await m.mirror.deliver("order-1")).toEqual({
      outcome: "success",
      providerReference: "Order:LAX-S-10482",
    });
    expect(byModule(m.saves, "Print_SKUs")).toEqual([
      {
        module: "Print_SKUs",
        id: null,
        fields: {
          SKU,
          Linked_Print_Product_Group: { id: "pp-1" },
          Size: "A3",
          Paper: "HAH",
          Frame: "UNF",
          Allocation_Bucket: "COL",
          Edition_Type: "Numbered",
        },
        matchOn: "SKU",
      },
    ]);
    expect(byModule(m.saves, "Edition_Ledgers")).toEqual([
      {
        module: "Edition_Ledgers",
        id: "led-1",
        fields: { Assigned_To_Client: 3, Assigned_To_Artist: 1, Assigned_To_LAX: 0, Print_Sold: 4 },
        matchOn: "LAX_Mirror_Key",
      },
    ]);
    // The group shows the run's prints sold too.
    expect(byModule(m.saves, "Print_Products")).toEqual([
      {
        module: "Print_Products",
        id: "pp-1",
        fields: { Print_Sold: 4 },
        matchOn: "Print_Group_ID",
      },
    ]);
    expect(m.runSales).toHaveBeenCalledWith("prints-1");
    // No frame and no fulfilment: nothing else is made.
    expect(m.saves).toHaveLength(3);
  });

  it("writes nothing the second time the same state arrives", async () => {
    const m = build({});
    await m.mirror.deliver("order-1");
    const after = m.saves.length;
    expect(await m.mirror.deliver("order-1")).toEqual({
      outcome: "skipped",
      reason: "order_already_in_sync",
    });
    expect(m.saves).toHaveLength(after);
  });

  it("counts a run's ledger once however many of its prints are on the order, and never for a proof", async () => {
    const m = build({
      facts: orderFacts({
        prints: [
          printLine({ lineId: "pl-3", isMainRun: false, printsArtworkId: "proof-1" }),
          printLine(),
          printLine({ lineId: "pl-2", allocation: "artist" }),
        ],
      }),
    });
    await m.mirror.deliver("order-1");
    expect(m.runSales).toHaveBeenCalledTimes(1);
    expect(m.runSales).toHaveBeenCalledWith("prints-1");
    expect(byModule(m.saves, "Print_SKUs").map((s) => s.fields.SKU)).toEqual([
      SKU,
      `${GROUP}-A3-HAH-UNF-ART`,
    ]);
  });

  it("queues a framing job linked to the Print SKU, with the edition and the framing details", async () => {
    const due = new Date("2026-12-01T00:00:00Z");
    const m = build({
      facts: orderFacts({ prints: [printLine({ framing: framing({ dueAt: due }) })] }),
    });
    await m.mirror.deliver("order-1");
    const sku = byModule(m.saves, "Print_SKUs")[0];
    expect(sku?.fields.Frame).toBe("FRB");
    const skuId = m.rows.find((r) => r.module === "Print_SKUs")?.id;
    expect(byModule(m.saves, "Framing_Jobs")).toEqual([
      {
        module: "Framing_Jobs",
        id: null,
        matchOn: "LAX_Order_Ref",
        fields: {
          LAX_Order_Ref: "LAX-S-10482/fl-1",
          Linked_Print_SKU: { id: skuId },
          Edition_Assigned: "ED 07/25",
          Status: "Queued",
          LAX_Framing_Spec: expect.stringContaining("lead time 10-15 working days; due 2026-12-01"),
        },
      },
    ]);
  });

  it("moves the framing job on, but never back past where staff took it in Zoho", async () => {
    const job = (Status: string): Row => ({
      id: "fj-1",
      module: "Framing_Jobs",
      fields: { LAX_Order_Ref: "LAX-S-10482/fl-1", Status },
    });
    const framed = orderFacts({
      prints: [printLine({ framing: framing({ taskStatus: "framed" }) })],
    });

    const forward = build({ facts: framed, rows: [...GROUP_ROWS, job("In Progress")] });
    await forward.mirror.deliver("order-1");
    expect(byModule(forward.saves, "Framing_Jobs")[0]).toMatchObject({
      id: "fj-1",
      fields: { Status: "Framed" },
    });

    const ahead = build({ facts: framed, rows: [...GROUP_ROWS, job("QC Passed")] });
    await ahead.mirror.deliver("order-1");
    expect(byModule(ahead.saves, "Framing_Jobs")[0]?.fields).not.toHaveProperty("Status");
  });

  it("marks a refunded print's framing job not required, and makes none that was never there", async () => {
    const refunded = orderFacts({
      prints: [printLine({ released: true, framing: framing({ taskStatus: "framing" }) })],
    });
    const existing = build({
      facts: refunded,
      rows: [
        ...GROUP_ROWS,
        {
          id: "fj-1",
          module: "Framing_Jobs",
          fields: { LAX_Order_Ref: "LAX-S-10482/fl-1", Status: "In Progress" },
        },
      ],
    });
    await existing.mirror.deliver("order-1");
    expect(
      byModule(existing.saves, "Framing_Jobs").map(({ id, fields }) => ({ id, fields })),
    ).toEqual([{ id: "fj-1", fields: { Status: "Not Required" } }]);

    const none = build({ facts: refunded });
    await none.mirror.deliver("order-1");
    expect(byModule(none.saves, "Framing_Jobs")).toEqual([]);

    // A refunded frame sold with a live print: its SKU is unframed and no job is made.
    const frameOnly = build({
      facts: orderFacts({ prints: [printLine({ framing: framing({ released: true }) })] }),
    });
    await frameOnly.mirror.deliver("order-1");
    expect(byModule(frameOnly.saves, "Framing_Jobs")).toEqual([]);
    expect(byModule(frameOnly.saves, "Print_SKUs")[0]?.fields.Frame).toBe("UNF");
  });

  it("recounts the ledger when a print is refunded, and writes nothing else for it", async () => {
    // 7/24 was mirrored as sold; its refund leaves none of the run sold.
    const sold = {
      Assigned_To_Client: 1,
      Assigned_To_Artist: 0,
      Assigned_To_LAX: 0,
      Print_Sold: 1,
    };
    const m = build({
      facts: orderFacts({
        prints: [printLine({ released: true, printPaper: "Somerset" })],
        fulfilment: { status: "cancelled", carrier: null, trackingNumber: null },
      }),
      rows: [
        { id: "pp-1", module: "Print_Products", fields: { Print_Group_ID: GROUP, Print_Sold: 1 } },
        {
          id: "led-1",
          module: "Edition_Ledgers",
          fields: { LAX_Mirror_Key: `group:${GROUP}`, ...sold },
        },
      ],
      sales: { collector: 0, artist: 0, lax: 0 },
    });
    // A refunded print's SKU is not worked out, so a listing staff can no longer fix fails nothing.
    expect(await m.mirror.deliver("order-1")).toEqual({
      outcome: "success",
      providerReference: "Order:LAX-S-10482",
    });
    expect(m.saves.map(({ module, id, fields }) => ({ module, id, fields }))).toEqual([
      {
        module: "Edition_Ledgers",
        id: "led-1",
        fields: { Assigned_To_Client: 0, Print_Sold: 0 },
      },
      { module: "Print_Products", id: "pp-1", fields: { Print_Sold: 0 } },
    ]);
  });

  it("makes the dispatch record once a print is picked and follows it to delivered", async () => {
    const picked = build({
      facts: orderFacts({
        anyPackConfirmed: true,
        fulfilment: { status: "in_production", carrier: null, trackingNumber: null },
      }),
    });
    await picked.mirror.deliver("order-1");
    expect(byModule(picked.saves, "Dispatch_Fulfilments")).toEqual([
      {
        module: "Dispatch_Fulfilments",
        id: null,
        fields: {
          LAX_Order_Ref: "LAX-S-10482",
          Status: "Pack Prep",
          LAX_Prints: `${SKU} ED 07/25`,
        },
        matchOn: "LAX_Order_Ref",
      },
    ]);

    const dispatched = (status: string): Row => ({
      id: "df-1",
      module: "Dispatch_Fulfilments",
      fields: { LAX_Order_Ref: "LAX-S-10482", Status: status, LAX_Prints: `${SKU} ED 07/25` },
    });
    const sent = build({
      facts: orderFacts({
        fulfilment: { status: "in_transit", carrier: " DPD ", trackingNumber: "15501234" },
      }),
      rows: [...GROUP_ROWS, dispatched("Ready")],
    });
    await sent.mirror.deliver("order-1");
    expect(byModule(sent.saves, "Dispatch_Fulfilments")).toEqual([
      {
        module: "Dispatch_Fulfilments",
        id: "df-1",
        fields: { Status: "Dispatched", Courier: "DPD", Tracking_Number: "15501234" },
        matchOn: "LAX_Order_Ref",
      },
    ]);

    // A late "dispatched" after Zoho already shows it delivered changes nothing.
    const late = build({
      facts: orderFacts({
        fulfilment: { status: "in_transit", carrier: null, trackingNumber: null },
      }),
      rows: [...GROUP_ROWS, dispatched("Delivered")],
    });
    await late.mirror.deliver("order-1");
    expect(byModule(late.saves, "Dispatch_Fulfilments")).toEqual([]);
  });

  it("makes no dispatch record before anything is picked", async () => {
    const m = build({
      facts: orderFacts({
        fulfilment: { status: "pending_production", carrier: null, trackingNumber: null },
      }),
    });
    await m.mirror.deliver("order-1");
    expect(byModule(m.saves, "Dispatch_Fulfilments")).toEqual([]);
  });

  it("retries in live while the print group or its ledger is not in Zoho yet", async () => {
    await expect(build({ rows: [] }).mirror.deliver("order-1")).rejects.toMatchObject({
      code: "print_group_not_in_zoho",
      retryable: true,
    });
    await expect(build({ rows: [GROUP_ROWS[0] as Row] }).mirror.deliver("order-1")).rejects.toThrow(
      CrmGatewayError,
    );
  });

  it("leaves prints of an original outside the register alone", async () => {
    for (const register of [null, { ...ORIGINAL, kind: "print" } as ArtworkRegisterEntry]) {
      const m = build({ register });
      expect(await m.mirror.deliver("order-1")).toEqual({
        outcome: "skipped",
        reason: "order_already_in_sync",
      });
      expect(m.saves).toEqual([]);
    }
    const none = build({
      facts: orderFacts({ prints: [printLine({ originalZohoProductId: null })] }),
    });
    await none.mirror.deliver("order-1");
    expect(none.saves).toEqual([]);
  });

  it("still queues the framing job, unlinked, for a print that has no SKU in Zoho", async () => {
    const framed = orderFacts({ prints: [printLine({ framing: framing() })] });
    // An original outside the register: the print is left alone, its frame is not.
    const outside = build({ register: null, facts: framed });
    expect(await outside.mirror.deliver("order-1")).toMatchObject({ outcome: "success" });
    expect(byModule(outside.saves, "Print_SKUs")).toEqual([]);
    const [job] = byModule(outside.saves, "Framing_Jobs");
    expect(job?.fields).toMatchObject({ LAX_Order_Ref: "LAX-S-10482/fl-1", Status: "Queued" });
    expect(job?.fields).not.toHaveProperty("Linked_Print_SKU");

    // A part that does not map: the order fails for staff to fix, and the frame is still there.
    const unmapped = build({
      facts: orderFacts({
        prints: [printLine({ printPaper: "Somerset", framing: framing() })],
      }),
    });
    expect(await unmapped.mirror.deliver("order-1")).toMatchObject({ outcome: "fatal" });
    expect(byModule(unmapped.saves, "Framing_Jobs")).toHaveLength(1);
  });

  it("mirrors the lines it can and fails the order on a SKU it cannot work out", async () => {
    const m = build({
      facts: orderFacts({
        prints: [printLine({ lineId: "bad", printPaper: "Somerset" }), printLine()],
      }),
    });
    const result = await m.mirror.deliver("order-1");
    expect(result).toMatchObject({
      outcome: "fatal",
      error: { code: "print_order_not_mirrored", retryable: false },
    });
    expect(String((result as { error: Error }).error.message)).toBe(
      'LAX-S-10482: bad: paper "Somerset" has no SKU code',
    );
    expect(byModule(m.saves, "Print_SKUs")).toHaveLength(1);
  });

  it("fails the order when the original's code cannot give a print code", async () => {
    const m = build({ register: { ...ORIGINAL, stockCode: "not-a-code" } });
    expect(await m.mirror.deliver("order-1")).toMatchObject({ outcome: "fatal" });
    expect(m.saves).toEqual([]);
  });

  it("in dry_run logs each write it would make and writes nothing, even before the group exists", async () => {
    const m = build({
      mode: "dry_run",
      rows: [],
      facts: orderFacts({
        prints: [printLine({ framing: framing() })],
        fulfilment: { status: "awaiting_dispatch", carrier: null, trackingNumber: null },
      }),
    });
    expect(await m.mirror.deliver("order-1")).toEqual({ outcome: "skipped", reason: "dry_run" });
    expect(m.saves).toEqual([]);
    const planned = m.log.info.mock.calls
      .filter(([, message]) => message === "order mirror would create, nothing written")
      .map(([detail]) => detail);
    expect(planned.map((d) => d.module)).toEqual([
      "Print_SKUs",
      "Framing_Jobs",
      "Dispatch_Fulfilments",
    ]);
    expect(planned[0]).toMatchObject({
      order: "LAX-S-10482",
      recordId: null,
      fields: { SKU: `${GROUP}-A3-HAH-FRB-COL` },
    });
    expect(planned[0]?.fields).not.toHaveProperty("Linked_Print_Product_Group");
    expect(planned[1]?.fields).toMatchObject({
      LAX_Order_Ref: "LAX-S-10482/fl-1",
      Status: "Queued",
    });
    expect(planned[2]?.fields).toEqual({
      LAX_Order_Ref: "LAX-S-10482",
      Status: "Ready",
      LAX_Prints: `${GROUP}-A3-HAH-FRB-COL ED 07/25`,
    });
    expect(m.log.info).toHaveBeenCalledWith(
      { code: GROUP },
      "edition ledger to be mirrored with its group",
    );
  });

  it("in dry_run says the job's link to a SKU it would create is pending, not missing", async () => {
    const planned = async (rows: Row[], register: ArtworkRegisterEntry | null = ORIGINAL) => {
      const m = build({
        mode: "dry_run",
        rows,
        register,
        facts: orderFacts({ prints: [printLine({ framing: framing() })] }),
      });
      await m.mirror.deliver("order-1");
      return m.log.info.mock.calls
        .map(([detail]) => detail)
        .find((detail) => detail?.module === "Framing_Jobs");
    };
    expect(await planned(GROUP_ROWS)).toMatchObject({ pendingFields: ["Linked_Print_SKU"] });
    const withSku: Row = {
      id: "sku-1",
      module: "Print_SKUs",
      fields: { SKU: `${GROUP}-A3-HAH-FRB-COL` },
    };
    const linked = await planned([...GROUP_ROWS, withSku]);
    expect(linked).not.toHaveProperty("pendingFields");
    expect(linked.fields).toMatchObject({ Linked_Print_SKU: { id: "sku-1" } });
    // No SKU is coming for an unregistered original, so nothing is pending.
    expect(await planned(GROUP_ROWS, null)).not.toHaveProperty("pendingFields");
  });

  it("in dry_run logs an update with the record's id", async () => {
    const m = build({
      mode: "dry_run",
      rows: [...GROUP_ROWS, { id: "sku-1", module: "Print_SKUs", fields: { SKU, Size: "A4" } }],
    });
    await m.mirror.deliver("order-1");
    expect(m.saves).toEqual([]);
    expect(m.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ module: "Print_SKUs", recordId: "sku-1" }),
      "order mirror would update, nothing written",
    );
  });
  it("never moves a dispatch status back, nor one Zoho holds that LAX does not rank", async () => {
    const held = (Status: string): Row => ({
      id: "df-1",
      module: "Dispatch_Fulfilments",
      fields: { LAX_Order_Ref: "LAX-S-10482", Status, LAX_Prints: `${SKU} ED 07/25` },
    });
    const packing = orderFacts({
      anyPackConfirmed: true,
      fulfilment: { status: "in_production", carrier: null, trackingNumber: null },
    });
    // Staff moved the parcel to a status of their own in Zoho; a second pick leaves it there.
    const qc = build({ facts: packing, rows: [...GROUP_ROWS, held("QC Passed")] });
    await qc.mirror.deliver("order-1");
    expect(byModule(qc.saves, "Dispatch_Fulfilments")).toEqual([]);
    expect(qc.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ module: "Dispatch_Fulfilments", status: "QC Passed" }),
      "order mirror leaves a status it does not rank; add it to the rank table",
    );
    // An unset picklist is filled in.
    const unset = build({ facts: packing, rows: [...GROUP_ROWS, held("-None-")] });
    await unset.mirror.deliver("order-1");
    expect(byModule(unset.saves, "Dispatch_Fulfilments")[0]?.fields).toEqual({
      Status: "Pack Prep",
    });
    expect(unset.log.warn).not.toHaveBeenCalled();
  });

  it("clears a courier and tracking number blanked in LAX, and lists only the prints still sold", async () => {
    const m = build({
      facts: orderFacts({
        prints: [printLine(), printLine({ lineId: "pl-2", released: true, editionNumber: 8 })],
        fulfilment: { status: "awaiting_dispatch", carrier: " ", trackingNumber: null },
      }),
      rows: [
        ...GROUP_ROWS,
        {
          id: "df-1",
          module: "Dispatch_Fulfilments",
          fields: {
            LAX_Order_Ref: "LAX-S-10482",
            Status: "Ready",
            Courier: "DPD",
            Tracking_Number: "155",
            LAX_Prints: `${SKU} ED 07/25; ${SKU} ED 08/25`,
          },
        },
      ],
    });
    await m.mirror.deliver("order-1");
    expect(byModule(m.saves, "Dispatch_Fulfilments")[0]?.fields).toEqual({
      Courier: null,
      Tracking_Number: null,
      LAX_Prints: `${SKU} ED 07/25`,
    });
  });

  it("converges when another delivery made the record between the find and the write", async () => {
    const m = build({});
    const find = m.zoho.find.bind(m.zoho);
    // The SKU is not there when this delivery looks, and is made by another one straight after.
    m.zoho.find = async (module, keyField, key, columns) => {
      const found = await find(module, keyField, key, columns);
      if (module === "Print_SKUs" && !found) {
        m.rows.push({ id: "sku-other", module, fields: { SKU: key, Size: "A3" } });
      }
      return found;
    };
    expect(await m.mirror.deliver("order-1")).toMatchObject({ outcome: "success" });
    expect(m.rows.filter((r) => r.module === "Print_SKUs").map((r) => r.id)).toEqual(["sku-other"]);
    expect(byModule(m.saves, "Print_SKUs")[0]).toMatchObject({ id: null, matchOn: "SKU" });
  });

  it("reads and writes each group, original and SKU once however many prints share them", async () => {
    const m = build({
      facts: orderFacts({
        prints: [printLine(), printLine({ lineId: "pl-2", editionNumber: 8 })],
        anyPackConfirmed: true,
        fulfilment: { status: "in_production", carrier: null, trackingNumber: null },
      }),
    });
    await m.mirror.deliver("order-1");
    expect(m.findByZohoProductId).toHaveBeenCalledTimes(1);
    expect(m.finds.filter((f) => f.startsWith("Print_Products:"))).toHaveLength(1);
    expect(m.finds.filter((f) => f.startsWith("Print_SKUs:"))).toHaveLength(1);
    expect(byModule(m.saves, "Print_SKUs")).toHaveLength(1);
    // Both prints left in the parcel, each with its own number.
    expect(byModule(m.saves, "Dispatch_Fulfilments")[0]?.fields.LAX_Prints).toBe(
      `${SKU} ED 07/25; ${SKU} ED 08/25`,
    );
  });

  it("logs a print it cannot mirror on a later step, instead of failing the order again", async () => {
    const facts = orderFacts({
      prints: [printLine({ lineId: "bad", printPaper: "Somerset" })],
      anyPackConfirmed: true,
      fulfilment: { status: "in_production", carrier: null, trackingNumber: null },
    });
    const m = build({ facts });
    expect(await m.mirror.deliver("order-1", { reportProblems: false })).toEqual({
      outcome: "success",
      providerReference: "Order:LAX-S-10482",
    });
    expect(m.log.warn).toHaveBeenCalledWith(
      { order: "LAX-S-10482", problems: ['bad: paper "Somerset" has no SKU code'] },
      "order mirror: prints still not mirrored, already failed for staff",
    );
    // Once the dispatch is in step, a repeat says why it wrote nothing.
    expect(await m.mirror.deliver("order-1", { reportProblems: false })).toEqual({
      outcome: "skipped",
      reason: "order_prints_not_mirrored",
    });
    expect(await m.mirror.deliver("order-1")).toMatchObject({ outcome: "fatal" });
  });
});
