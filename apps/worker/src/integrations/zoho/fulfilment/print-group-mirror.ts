import { StockCodeError, printCodeForOriginal } from "@auction/artwork-register-contracts";
import type { IArtworkRegisterRepository } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { CrmGatewayError } from "../../crm/crm-gateway-error.js";
import type { CrmSyncResult } from "../../crm/crm-sync-result.js";
import { planLedger, planPrintProduct } from "./plan-print-group.js";
import type { PrintGroupFactsReader } from "./print-group-facts.js";
import type { ZohoPrintModules } from "./zoho-print-modules.js";

export type PrintGroupMirrorDeps = {
  facts: PrintGroupFactsReader;
  register: Pick<
    IArtworkRegisterRepository,
    "findByZohoProductId" | "findByStockCode" | "issuePrintGroup"
  >;
  zoho: ZohoPrintModules;
  mode: "dry_run" | "live";
  now: () => Date;
  log: Pick<Logger, "info" | "warn">;
};

/** A reason the group cannot be mirrored and cannot be put right by trying again. */
function fatal(code: string, message: string): CrmSyncResult {
  return {
    outcome: "fatal",
    error: new CrmGatewayError({ code, message, status: 409, retryable: false }),
  };
}

/**
 * Brings one prints listing's group into line: its Print_Products and Edition_Ledgers records in
 * Zoho, and its row in the artwork register under the code that mirrors its original
 * (`LAX-ORI-MP-GAC-26-0037` becomes `LAX-PRT-MP-GAC-26-0037`).
 *
 * Every step reads LAX and Zoho as they are now and writes only what differs, so an event that
 * arrives twice, late or out of order sends nothing it should not. Nothing is written to Zoho in
 * `dry_run`, and nothing is added to the register either, because the register row is keyed to the
 * Zoho record that does not exist yet.
 */
export class PrintGroupMirror {
  constructor(private readonly deps: PrintGroupMirrorDeps) {}

  async deliver(printsArtworkId: string): Promise<CrmSyncResult> {
    const { facts: reader, register, zoho, mode } = this.deps;
    const facts = await reader.read(printsArtworkId);
    if (!facts?.original) return { outcome: "skipped", reason: "not_a_print_of_an_original" };
    if (!facts.original.zohoProductId) {
      return { outcome: "skipped", reason: "original_not_in_register" };
    }
    const original = await register.findByZohoProductId(facts.original.zohoProductId);
    if (original?.kind !== "original") {
      return { outcome: "skipped", reason: "original_not_in_register" };
    }

    let code: string;
    try {
      code = printCodeForOriginal(original.stockCode);
    } catch (error) {
      if (!(error instanceof StockCodeError)) throw error;
      return fatal("stock_code_unusable", error.message);
    }
    // Checked before any Zoho write, so a clash can never overwrite another group's record.
    const holder = await register.findByStockCode(code);
    if (holder && holder.sourceOriginalId !== original.id) {
      return fatal(
        "print_code_taken_by_other_original",
        `${code} already belongs to a print of a different original`,
      );
    }

    const state = await zoho.readGroup(code);
    const productWrite = planPrintProduct(code, facts, state);
    if (mode === "dry_run") {
      this.deps.log.info(
        {
          printsArtworkId,
          code,
          printProductWrite: productWrite !== null,
          ledgerWrite: state.printProduct
            ? planLedger(code, facts, state, state.printProduct.id) !== null
            : true,
          registerRow: holder === null,
        },
        "print group planned, nothing written",
      );
      return { outcome: "skipped", reason: "dry_run" };
    }

    let wrote = 0;
    let printProductId = state.printProduct?.id ?? null;
    if (productWrite) {
      printProductId = await zoho.upsertPrintProduct(productWrite);
      wrote += 1;
    }
    // A missing record always has a write planned, so the id exists from here on.
    if (!printProductId) throw new Error("print_group_without_zoho_record");

    // The register row is keyed to the group's Zoho record, so it follows the record's creation.
    if (!holder) {
      const issued = await register.issuePrintGroup(
        original.id,
        {
          zohoProductId: printProductId,
          title: facts.title,
          medium: facts.medium,
          dimensions: facts.dimensions,
          year: facts.year,
          imageRefs: [],
          catalogueStatus: null,
        },
        "system",
        this.deps.now(),
      );
      if (!issued.ok && issued.reason !== "print_group_exists") {
        return fatal(issued.reason, issued.message);
      }
      wrote += issued.ok ? 1 : 0;
    }

    const ledgerWrite = planLedger(code, facts, state, printProductId);
    if (ledgerWrite) {
      await zoho.upsertLedger(ledgerWrite);
      wrote += 1;
    }

    return wrote > 0
      ? { outcome: "success", providerReference: `Print_Products:${printProductId}` }
      : { outcome: "skipped", reason: "print_group_already_in_sync" };
  }
}
