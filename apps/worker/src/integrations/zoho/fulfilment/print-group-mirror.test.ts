import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { IArtworkRegisterRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type {
  EditionLedgerFields,
  PrintProductFields,
  ZohoPrintGroupState,
} from "./plan-print-group.js";
import type { PrintGroupFacts } from "./print-group-facts.js";
import { PrintGroupMirror } from "./print-group-mirror.js";
import type { ZohoPrintModules } from "./zoho-print-modules.js";

const ORIGINAL_CODE = "LAX-ORI-MP-GAC-26-0037";
const GROUP_CODE = "LAX-PRT-MP-GAC-26-0037";
type IssueRegisterEntryResult = Awaited<ReturnType<IArtworkRegisterRepository["issuePrintGroup"]>>;
const NOW = new Date("2026-11-09T09:00:00.000Z");

const facts = (over: Partial<PrintGroupFacts> = {}): PrintGroupFacts => ({
  printsArtworkId: "prints-1",
  isMainRun: true,
  otherMainRunsOnOriginal: 0,
  title: "Harbour at dusk (prints)",
  medium: "Screenprint",
  dimensions: "50 x 70 cm",
  year: 2026,
  original: { artworkId: "orig-1", zohoProductId: "zp-orig" },
  editionType: "Numbered",
  total: 24,
  collector: 10,
  artist: 10,
  lax: 4,
  ...over,
});

const entry = (over: Partial<ArtworkRegisterEntry>): ArtworkRegisterEntry =>
  ({
    id: "reg-orig",
    zohoProductId: "zp-orig",
    stockCode: ORIGINAL_CODE,
    kind: "original",
    sourceOriginalId: null,
    ...over,
  }) as ArtworkRegisterEntry;

/** The register as the repository behaves: one row per code, and one print group per original. */
function fakeRegister(rows: ArtworkRegisterEntry[]) {
  const issuePrintGroup = vi.fn(
    async (
      originalId: string,
      input: { zohoProductId: string },
    ): Promise<IssueRegisterEntryResult> => {
      const original = rows.find((row) => row.id === originalId);
      if (!original) return { ok: false, reason: "original_not_found", message: "no original" };
      const stockCode = original.stockCode.replace("LAX-ORI-", "LAX-PRT-");
      const held = rows.find((row) => row.stockCode === stockCode);
      if (held) {
        return {
          ok: false,
          reason:
            held.sourceOriginalId === originalId
              ? "print_group_exists"
              : "print_code_taken_by_other_original",
          message: "taken",
        };
      }
      const created = entry({
        id: `reg-${rows.length}`,
        zohoProductId: input.zohoProductId,
        stockCode,
        kind: "print",
        sourceOriginalId: originalId,
      });
      rows.push(created);
      return { ok: true, entry: created };
    },
  );
  return {
    rows,
    issuePrintGroup,
    findByZohoProductId: async (id: string) => rows.find((row) => row.zohoProductId === id) ?? null,
    findByStockCode: async (code: string) => rows.find((row) => row.stockCode === code) ?? null,
  };
}

/** Zoho as the keyed upserts behave: the same key updates the same record. */
function fakeZoho() {
  const state: ZohoPrintGroupState = { printProduct: null, ledger: null };
  const upsertPrintProduct = vi.fn(async (fields: PrintProductFields) => {
    state.printProduct = { id: "pp-1", fields };
    return "pp-1";
  });
  const upsertLedger = vi.fn(async (fields: EditionLedgerFields) => {
    state.ledger = { id: "led-1", fields };
    return "led-1";
  });
  const zoho: ZohoPrintModules = {
    readGroup: async () => ({ printProduct: state.printProduct, ledger: state.ledger }),
    upsertPrintProduct,
    upsertLedger,
  };
  return { zoho, upsertPrintProduct, upsertLedger };
}

function setup(
  over: {
    facts?: PrintGroupFacts | null;
    rows?: ArtworkRegisterEntry[];
    mode?: "dry_run" | "live";
  } = {},
) {
  const register = fakeRegister(over.rows ?? [entry({})]);
  const zoho = fakeZoho();
  const mirror = new PrintGroupMirror({
    facts: { read: async () => (over.facts === undefined ? facts() : over.facts) },
    register,
    zoho: zoho.zoho,
    mode: over.mode ?? "live",
    now: () => NOW,
    log: { info: vi.fn(), warn: vi.fn() },
  });
  return { mirror, register, ...zoho };
}

describe("PrintGroupMirror", () => {
  it("gives a new print group its code from the original, in Zoho and in the register", async () => {
    const { mirror, register, upsertPrintProduct, upsertLedger } = setup();

    const result = await mirror.deliver("prints-1");

    expect(result).toEqual({ outcome: "success", providerReference: "Print_Products:pp-1" });
    expect(upsertPrintProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        Print_Group_ID: GROUP_CODE,
        Total_Edition_Quantity: 24,
        Collector_Allocation: 10,
        Artist_Allocation: 10,
        LAX_Allocation: 4,
        Linked_Original_Artwork: "zp-orig",
      }),
    );
    expect(register.issuePrintGroup).toHaveBeenCalledWith(
      "reg-orig",
      expect.objectContaining({ zohoProductId: "pp-1", title: "Harbour at dusk (prints)" }),
      "system",
      NOW,
    );
    expect(register.rows.find((row) => row.kind === "print")).toMatchObject({
      stockCode: GROUP_CODE,
      sourceOriginalId: "reg-orig",
    });
    // The mirror carries the code: the ledger is keyed by it and points at the group.
    expect(upsertLedger).toHaveBeenCalledWith({
      LAX_Mirror_Key: `group:${GROUP_CODE}`,
      Linked_Print_Product_Group: "pp-1",
      Total_Edition: 24,
    });
    // What sold is the order mirror's to write; none of it is sent from the run's plan.
    expect(JSON.stringify(upsertLedger.mock.calls)).not.toMatch(/Assigned_To|Print_Sold/);
    expect(JSON.stringify(upsertPrintProduct.mock.calls)).not.toMatch(/Print_Sold/);
  });

  it("reuses the code on a re-run: no second group, no second write", async () => {
    const { mirror, register, upsertPrintProduct, upsertLedger } = setup();
    await mirror.deliver("prints-1");

    const again = await mirror.deliver("prints-1");

    expect(again).toEqual({ outcome: "skipped", reason: "print_group_already_in_sync" });
    expect(register.issuePrintGroup).toHaveBeenCalledTimes(1);
    expect(register.rows.filter((row) => row.kind === "print")).toHaveLength(1);
    expect(upsertPrintProduct).toHaveBeenCalledTimes(1);
    expect(upsertLedger).toHaveBeenCalledTimes(1);
  });

  it("writes only what changed when the run's numbers move", async () => {
    const first = setup();
    await first.mirror.deliver("prints-1");
    const changed = new PrintGroupMirror({
      facts: { read: async () => facts({ lax: 3, artist: 11 }) },
      register: first.register,
      zoho: { ...first.zoho, readGroup: first.zoho.readGroup },
      mode: "live",
      now: () => NOW,
      log: { info: vi.fn(), warn: vi.fn() },
    });

    const result = await changed.deliver("prints-1");

    expect(result.outcome).toBe("success");
    expect(first.register.issuePrintGroup).toHaveBeenCalledTimes(1);
    expect(first.upsertPrintProduct).toHaveBeenCalledTimes(2);
  });

  it("adds the missing register row without a second Zoho group when only the row is absent", async () => {
    const { mirror, register, upsertPrintProduct } = setup();
    await mirror.deliver("prints-1");
    register.rows.splice(1, 1);

    await mirror.deliver("prints-1");

    expect(register.issuePrintGroup).toHaveBeenCalledTimes(2);
    expect(register.rows.filter((row) => row.kind === "print")).toHaveLength(1);
    expect(upsertPrintProduct).toHaveBeenCalledTimes(1);
  });

  it("writes nothing to Zoho or the register when another original holds the code", async () => {
    const { mirror, register, upsertPrintProduct, upsertLedger } = setup({
      rows: [
        entry({}),
        entry({
          id: "reg-other",
          zohoProductId: "zp-x",
          stockCode: GROUP_CODE,
          kind: "print",
          sourceOriginalId: "someone-else",
        }),
      ],
    });

    const result = await mirror.deliver("prints-1");

    expect(result).toMatchObject({
      outcome: "fatal",
      error: { code: "print_code_taken_by_other_original" },
    });
    expect(upsertPrintProduct).not.toHaveBeenCalled();
    expect(upsertLedger).not.toHaveBeenCalled();
    expect(register.issuePrintGroup).not.toHaveBeenCalled();
  });

  it("mirrors the main run only: a proof listing on the same original writes nothing", async () => {
    const main = setup();
    await main.mirror.deliver("prints-1");
    const proof = new PrintGroupMirror({
      facts: {
        read: async () =>
          facts({
            printsArtworkId: "proof-1",
            isMainRun: false,
            total: 0,
            collector: 0,
            artist: 0,
            lax: 0,
          }),
      },
      register: main.register,
      zoho: main.zoho,
      mode: "live",
      now: () => NOW,
      log: { info: vi.fn(), warn: vi.fn() },
    });

    expect(await proof.deliver("proof-1")).toEqual({
      outcome: "skipped",
      reason: "not_the_main_run",
    });

    // The main run's numbers are untouched by the proof's 0 / 0 / 0.
    expect(main.upsertPrintProduct).toHaveBeenCalledTimes(1);
    expect(main.upsertLedger).toHaveBeenCalledTimes(1);
    expect(main.register.issuePrintGroup).toHaveBeenCalledTimes(1);
    expect(await main.mirror.deliver("prints-1")).toEqual({
      outcome: "skipped",
      reason: "print_group_already_in_sync",
    });
  });

  it("fails, writing nothing, when another main run is made from the same original", async () => {
    const { mirror, register, upsertPrintProduct, upsertLedger } = setup({
      facts: facts({ otherMainRunsOnOriginal: 1 }),
    });

    expect(await mirror.deliver("prints-1")).toMatchObject({
      outcome: "fatal",
      error: { code: "original_has_several_main_runs" },
    });
    expect(upsertPrintProduct).not.toHaveBeenCalled();
    expect(upsertLedger).not.toHaveBeenCalled();
    expect(register.issuePrintGroup).not.toHaveBeenCalled();
  });

  it("dry_run plans and logs but writes nothing anywhere", async () => {
    const { mirror, register, upsertPrintProduct, upsertLedger } = setup({ mode: "dry_run" });

    const result = await mirror.deliver("prints-1");

    expect(result).toEqual({ outcome: "skipped", reason: "dry_run" });
    expect(upsertPrintProduct).not.toHaveBeenCalled();
    expect(upsertLedger).not.toHaveBeenCalled();
    expect(register.issuePrintGroup).not.toHaveBeenCalled();
  });

  it("skips a listing that is not a print of an original, and an original not in the register", async () => {
    expect((await setup({ facts: facts({ original: null }) }).mirror.deliver("x")).outcome).toBe(
      "skipped",
    );
    expect((await setup({ facts: null }).mirror.deliver("x")).outcome).toBe("skipped");
    expect(
      await setup({
        facts: facts({ original: { artworkId: "orig-1", zohoProductId: null } }),
      }).mirror.deliver("x"),
    ).toEqual({ outcome: "skipped", reason: "original_not_in_register" });
    const unknown = setup({ rows: [] });
    expect(await unknown.mirror.deliver("x")).toEqual({
      outcome: "skipped",
      reason: "original_not_in_register",
    });
    expect(unknown.upsertPrintProduct).not.toHaveBeenCalled();
  });

  it("fails clearly, without a Zoho write, for an original whose code cannot have a print group", async () => {
    const { mirror, upsertPrintProduct } = setup({ rows: [entry({ stockCode: "NOT-A-CODE" })] });

    expect(await mirror.deliver("prints-1")).toMatchObject({
      outcome: "fatal",
      error: { code: "stock_code_unusable" },
    });
    expect(upsertPrintProduct).not.toHaveBeenCalled();
  });

  it("treats a group that already exists in the register as done, and fails on any other refusal", async () => {
    const exists = setup();
    exists.register.issuePrintGroup.mockResolvedValueOnce({
      ok: false,
      reason: "print_group_exists",
      message: "exists",
    });
    expect((await exists.mirror.deliver("prints-1")).outcome).toBe("success");

    const refused = setup();
    refused.register.issuePrintGroup.mockResolvedValueOnce({
      ok: false,
      reason: "duplicate_zoho_product",
      message: "dup",
    });
    expect(await refused.mirror.deliver("prints-1")).toMatchObject({
      outcome: "fatal",
      error: { code: "duplicate_zoho_product" },
    });
  });
});
