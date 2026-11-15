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
  type WriteRules,
  type ZohoFields,
  type ZohoRecordState,
  dispatchStatusOf,
  editionAssigned,
  holdsUnrankedStatus,
  ledgerCounts,
  parcelPrints,
  planWrite,
  printSkuOf,
  printsSold,
  wantedPrintSku,
} from "./plan-order.js";
import { ledgerMirrorKey } from "./plan-print-group.js";
import type { OrderModule, ZohoOrderRecords } from "./zoho-order-modules.js";

/**
 * The Zoho fields LAX writes its own references into. Dispatch_Fulfilments has no field that names
 * the LAX order or the prints in the parcel, so the owners add them and their API names are set
 * here.
 */
export type OrderMirrorFields = {
  /** Holds the order reference on the records LAX creates (unique, text). */
  orderRef: string;
  /** Holds the prints in the parcel on the order's dispatch: each one's SKU and edition label. */
  dispatchPrints: string;
};

export type OrderMirrorDeps = {
  facts: OrderFulfilmentFactsReader;
  register: Pick<IArtworkRegisterRepository, "findByZohoProductId">;
  zoho: ZohoOrderRecords;
  fields: OrderMirrorFields;
  mode: "dry_run" | "live";
  log: Pick<Logger, "info" | "warn">;
};

export type OrderDeliveryOptions = {
  /**
   * False for an event that does not change which prints are on the order (a pick, a dispatch
   * step): a line that cannot be mirrored was already failed for staff when the order was paid or
   * the print swapped, so it is logged and the event is not failed a second time. Default true.
   */
  reportProblems?: boolean;
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
const LEDGER_COLUMNS = [
  "Assigned_To_Client",
  "Assigned_To_Artist",
  "Assigned_To_LAX",
  "Print_Sold",
] as const;
const GROUP_COLUMNS = ["Print_Sold"] as const;

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
 * per SKU, shared by every order of it), the group's sold counts, and the order's
 * Dispatch_Fulfilments record with the prints in the parcel. Staff do the work in LAX Admin; this
 * only keeps Zoho complete for reporting.
 *
 * Every event for the order runs the same pass over LAX and Zoho as they are now and writes only
 * what differs, so an event that arrives twice, late or out of order writes nothing stale; a status
 * is only ever moved forward. In `dry_run` it logs each write it would make and writes nothing.
 */
export class OrderMirror {
  constructor(private readonly deps: OrderMirrorDeps) {}

  async deliver(orderId: string, options: OrderDeliveryOptions = {}): Promise<CrmSyncResult> {
    const facts = await this.deps.facts.read(orderId);
    if (!facts) return { outcome: "skipped", reason: "order_not_found" };
    if (!facts.paid) return { outcome: "skipped", reason: "order_not_paid" };
    if (facts.prints.length === 0) return { outcome: "skipped", reason: "no_prints_on_order" };

    const pass = new OrderPass(this.deps, facts);
    const problems: string[] = [];
    for (const line of facts.prints) {
      const problem = await pass.mirrorLine(line);
      if (problem) problems.push(`${line.lineId}: ${problem}`);
    }
    await pass.mirrorDispatch();

    const reportProblems = options.reportProblems ?? true;
    if (problems.length > 0 && reportProblems) {
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
    if (problems.length > 0) {
      this.deps.log.warn(
        { order: facts.reference, problems },
        "order mirror: prints still not mirrored, already failed for staff",
      );
    }
    if (this.deps.mode === "dry_run") return { outcome: "skipped", reason: "dry_run" };
    if (pass.wrote > 0) {
      return { outcome: "success", providerReference: `Order:${facts.reference}` };
    }
    return {
      outcome: "skipped",
      reason: problems.length > 0 ? "order_prints_not_mirrored" : "order_already_in_sync",
    };
  }
}

/** One pass over one order; counts what it writes and reads each Zoho record at most once. */
class OrderPass {
  wrote = 0;
  /** The prints in the parcel, for the dispatch record. */
  private readonly parcel: { sku: string; edition: string | null }[] = [];
  private readonly ledgersDone = new Set<string>();
  private readonly skusDone = new Set<string>();
  private readonly groups = new Map<string, Promise<ZohoRecordState | null>>();
  private readonly codes = new Map<string, Promise<string | null | { problem: string }>>();

  constructor(
    private readonly deps: OrderMirrorDeps,
    private readonly facts: OrderFulfilmentFacts,
  ) {}

  /** Mirrors one print line; answers why it cannot be, or null. */
  async mirrorLine(line: PrintLineFacts): Promise<string | null> {
    const code = await this.groupCodeOf(line);
    if (code === null) {
      // Prints of an original outside the register have no group in Zoho to hang from.
      this.deps.log.info({ orderLineId: line.lineId }, "print not of a registered original");
      return null;
    }
    if (typeof code !== "string") return code.problem;
    const group = await this.groupOf(code);

    // The ledger counts the run as LAX holds it now, so a refunded print lowers it too.
    if (line.isMainRun && !this.ledgersDone.has(code)) {
      this.ledgersDone.add(code);
      await this.mirrorLedger(code, line.printsArtworkId);
    }

    // A refunded print's SKU record stays for the other orders of it, and it left in no parcel.
    if (line.released) return null;

    const sku = printSkuOf(line, code);
    if (!sku.ok) return sku.reason;
    this.parcel.push({ sku: sku.value.sku, edition: editionAssigned(line) });
    if (this.skusDone.has(sku.value.sku)) return null;
    this.skusDone.add(sku.value.sku);

    const printSku = await this.deps.zoho.find("Print_SKUs", "SKU", sku.value.sku, SKU_COLUMNS);
    await this.apply(
      "Print_SKUs",
      printSku,
      wantedPrintSku(sku.value, line, group?.id ?? null),
      "SKU",
    );
    return null;
  }

  async mirrorDispatch(): Promise<void> {
    const { fulfilment, anyPackConfirmed, reference } = this.facts;
    if (!fulfilment) return;
    const { orderRef: ref, dispatchPrints } = this.deps.fields;
    const current = await this.deps.zoho.find("Dispatch_Fulfilments", ref, reference, [
      ref,
      "Status",
      "Courier",
      "Tracking_Number",
      dispatchPrints,
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
        [dispatchPrints]: parcelPrints(this.parcel),
      },
      ref,
      {
        status: { field: "Status", rank: "dispatch" },
        // LAX Admin is where these are recorded; one blanked there is cleared in Zoho too.
        clears: ["Courier", "Tracking_Number", dispatchPrints],
      },
    );
  }

  /** The run's sold counts on the group's ledger, and the total sold on the ledger and group. */
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
    await this.apply("Edition_Ledgers", ledger, ledgerCounts(sales), "LAX_Mirror_Key");
    const group = await this.groupOf(code);
    if (group) {
      await this.apply(
        "Print_Products",
        group,
        { Print_Sold: printsSold(sales) },
        "Print_Group_ID",
      );
    }
  }

  /** The group's Print_Products record; in `live` its absence is retried. */
  private groupOf(code: string): Promise<ZohoRecordState | null> {
    let group = this.groups.get(code);
    if (!group) {
      group = this.deps.zoho
        .find("Print_Products", "Print_Group_ID", code, GROUP_COLUMNS)
        .then((found) => {
          if (!found && this.deps.mode === "live") throw notYetInZoho("print_group");
          return found;
        });
      this.groups.set(code, group);
    }
    return group;
  }

  /** The print's group code, null when its original is not registered, or why it cannot be. */
  private groupCodeOf(line: PrintLineFacts): Promise<string | null | { problem: string }> {
    const productId = line.originalZohoProductId;
    if (!productId) return Promise.resolve(null);
    let code = this.codes.get(productId);
    if (!code) {
      code = this.lookUpGroupCode(productId);
      this.codes.set(productId, code);
    }
    return code;
  }

  private async lookUpGroupCode(productId: string): Promise<string | null | { problem: string }> {
    const original = await this.deps.register.findByZohoProductId(productId);
    if (original?.kind !== "original") return null;
    try {
      return printCodeForOriginal(original.stockCode);
    } catch (error) {
      if (!(error instanceof StockCodeError)) throw error;
      return { problem: error.message };
    }
  }

  /**
   * Writes what differs, or in `dry_run` logs it; answers the record's id, null if not made. A new
   * record is matched on `matchOn`, so one another delivery made meanwhile is updated, not doubled.
   */
  private async apply(
    module: OrderModule,
    current: ZohoRecordState | null,
    wanted: ZohoFields,
    matchOn: string,
    rules: WriteRules = {},
  ): Promise<string | null> {
    if (rules.status && holdsUnrankedStatus(current, rules.status)) {
      this.deps.log.warn(
        {
          order: this.facts.reference,
          module,
          recordId: current?.id ?? null,
          status: current?.fields[rules.status.field],
        },
        "order mirror leaves a status it does not rank; add it to the rank table",
      );
    }
    const write = planWrite(wanted, current, rules);
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
    const id = await this.deps.zoho.save(module, current?.id ?? null, write, matchOn);
    this.wrote += 1;
    return id;
  }
}
