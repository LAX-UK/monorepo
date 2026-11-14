import { StockCodeError, printCodeForOriginal } from "@auction/artwork-register-contracts";
import type { IArtworkRegisterRepository } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { CrmGatewayError } from "../../crm/crm-gateway-error.js";
import type { CrmSyncResult } from "../../crm/crm-sync-result.js";
import type {
  OrderFulfilmentFacts,
  OrderFulfilmentFactsReader,
  PrintLineFacts,
} from "./order-facts.js";
import {
  type ZohoFields,
  type ZohoRecordState,
  dispatchStatusOf,
  ledgerCounts,
  planWrite,
  printSkuOf,
  wantedPrintSku,
} from "./plan-order.js";
import { ledgerMirrorKey } from "./plan-print-group.js";
import type { OrderModule, ZohoOrderRecords } from "./zoho-order-modules.js";

/**
 * The Zoho fields LAX writes its own references into. Dispatch_Fulfilments has no field that names
 * the LAX order, so the owners add one (unique, text) and its API name is set here.
 */
export type OrderMirrorFields = {
  /** Holds the order reference on the records LAX creates. */
  orderRef: string;
};

export type OrderMirrorDeps = {
  facts: OrderFulfilmentFactsReader;
  register: Pick<IArtworkRegisterRepository, "findByZohoProductId">;
  zoho: ZohoOrderRecords;
  fields: OrderMirrorFields;
  mode: "dry_run" | "live";
  log: Pick<Logger, "info" | "warn">;
};

const SKU_COLUMNS = [
  "SKU",
  "Linked_Print_Product_Group",
  "Size",
  "Paper",
  "Frame",
  "Allocation_Bucket",
  "Edition_Type",
] as const;
const LEDGER_COLUMNS = ["Assigned_To_Client", "Assigned_To_Artist", "Assigned_To_LAX"] as const;

/** Zoho does not hold a record the order's records hang from yet; a later try may find it. */
function notYetInZoho(what: string): CrmGatewayError {
  return new CrmGatewayError({
    code: `${what}_not_in_zoho`,
    message: `The ${what.replaceAll("_", " ")} is not in Zoho yet`,
    status: 503,
    retryable: true,
  });
}

/**
 * Mirrors one order's print fulfilment to Zoho CRM, one way: each print's Print_SKUs record (one
 * per SKU, shared by every order of it), the group ledger's sold counts, and the order's
 * Dispatch_Fulfilments record. Staff do the work in LAX Admin; this
 * only keeps Zoho complete for reporting.
 *
 * Every event for the order runs the same pass over LAX and Zoho as they are now and writes only
 * what differs, so an event that arrives twice, late or out of order writes nothing stale; a status
 * is only ever moved forward. In `dry_run` it logs each write it would make and writes nothing.
 */
export class OrderMirror {
  constructor(private readonly deps: OrderMirrorDeps) {}

  async deliver(orderId: string): Promise<CrmSyncResult> {
    const facts = await this.deps.facts.read(orderId);
    if (!facts) return { outcome: "skipped", reason: "order_not_found" };
    if (!facts.paid) return { outcome: "skipped", reason: "order_not_paid" };
    if (facts.prints.length === 0) return { outcome: "skipped", reason: "no_prints_on_order" };

    const pass = new OrderPass(this.deps, facts);
    const problems: string[] = [];
    const ledgersDone = new Set<string>();
    for (const line of facts.prints) {
      const problem = await pass.mirrorLine(line, ledgersDone);
      if (problem) problems.push(`${line.lineId}: ${problem}`);
    }
    await pass.mirrorDispatch();

    if (problems.length > 0) {
      // The other lines are mirrored; these need staff to put the listing right.
      return {
        outcome: "fatal",
        error: new CrmGatewayError({
          code: "print_order_not_mirrored",
          message: `${facts.reference}: ${problems.join("; ")}`,
          status: 409,
          retryable: false,
        }),
      };
    }
    if (this.deps.mode === "dry_run") return { outcome: "skipped", reason: "dry_run" };
    return pass.wrote > 0
      ? { outcome: "success", providerReference: `Order:${facts.reference}` }
      : { outcome: "skipped", reason: "order_already_in_sync" };
  }
}

/** One pass over one order; counts what it writes. */
class OrderPass {
  wrote = 0;

  constructor(
    private readonly deps: OrderMirrorDeps,
    private readonly facts: OrderFulfilmentFacts,
  ) {}

  /** Mirrors one print line; answers why it cannot be, or null. */
  async mirrorLine(line: PrintLineFacts, ledgersDone: Set<string>): Promise<string | null> {
    const { zoho } = this.deps;
    // A refunded print is not mirrored: its SKU record stays for the other orders of it.
    if (line.released) return null;

    const code = await this.groupCodeOf(line);
    if (code === null) {
      // Prints of an original outside the register have no group in Zoho to hang from.
      this.deps.log.info({ orderLineId: line.lineId }, "print not of a registered original");
      return null;
    }
    if (typeof code !== "string") return code.problem;
    const sku = printSkuOf(line, code);
    if (!sku.ok) return sku.reason;

    const group = await zoho.find("Print_Products", "Print_Group_ID", code, []);
    if (!group && this.deps.mode === "live") throw notYetInZoho("print_group");
    const printSku = await zoho.find("Print_SKUs", "SKU", sku.value.sku, SKU_COLUMNS);
    await this.apply("Print_SKUs", printSku, wantedPrintSku(sku.value, line, group?.id ?? null));

    if (line.isMainRun && !ledgersDone.has(code)) {
      ledgersDone.add(code);
      await this.mirrorLedger(code, line.printsArtworkId);
    }

    return null;
  }

  async mirrorDispatch(): Promise<void> {
    const { fulfilment, anyPackConfirmed, reference } = this.facts;
    if (!fulfilment) return;
    const ref = this.deps.fields.orderRef;
    const current = await this.deps.zoho.find("Dispatch_Fulfilments", ref, reference, [
      ref,
      "Status",
      "Courier",
      "Tracking_Number",
    ]);
    const status = dispatchStatusOf(fulfilment, anyPackConfirmed);
    // Nothing is made in Zoho before there is a parcel to prepare.
    if (!current && !status) return;
    await this.apply(
      "Dispatch_Fulfilments",
      current,
      {
        [ref]: reference,
        Status: status,
        Courier: fulfilment.carrier?.trim() || null,
        Tracking_Number: fulfilment.trackingNumber?.trim() || null,
      },
      "dispatch",
    );
  }

  private async mirrorLedger(code: string, printsArtworkId: string): Promise<void> {
    const ledger = await this.deps.zoho.find(
      "Edition_Ledgers",
      "LAX_Mirror_Key",
      ledgerMirrorKey(code),
      LEDGER_COLUMNS,
    );
    if (!ledger) {
      // The print group mirror makes the ledger; only it decides the record's key and total.
      if (this.deps.mode === "live") throw notYetInZoho("edition_ledger");
      this.deps.log.info({ code }, "edition ledger to be mirrored with its group");
      return;
    }
    const sales = await this.deps.facts.runSales(printsArtworkId);
    await this.apply("Edition_Ledgers", ledger, ledgerCounts(sales));
  }

  /** The print's group code, null when its original is not registered, or why it cannot be. */
  private async groupCodeOf(line: PrintLineFacts): Promise<string | null | { problem: string }> {
    if (!line.originalZohoProductId) return null;
    const original = await this.deps.register.findByZohoProductId(line.originalZohoProductId);
    if (original?.kind !== "original") return null;
    try {
      return printCodeForOriginal(original.stockCode);
    } catch (error) {
      if (!(error instanceof StockCodeError)) throw error;
      return { problem: error.message };
    }
  }

  /** Writes what differs, or in `dry_run` logs it; answers the record's id, null if not made. */
  private async apply(
    module: OrderModule,
    current: ZohoRecordState | null,
    wanted: ZohoFields,
    rank?: "dispatch",
  ): Promise<string | null> {
    const write = planWrite(wanted, current, rank ? { field: "Status", rank } : undefined);
    if (!write) return current?.id ?? null;
    if (this.deps.mode === "dry_run") {
      this.deps.log.info(
        { order: this.facts.reference, module, recordId: current?.id ?? null, fields: write },
        current
          ? "order mirror would update, nothing written"
          : "order mirror would create, nothing written",
      );
      return current?.id ?? null;
    }
    const id = await this.deps.zoho.save(module, current?.id ?? null, write);
    this.wrote += 1;
    return id;
  }
}
