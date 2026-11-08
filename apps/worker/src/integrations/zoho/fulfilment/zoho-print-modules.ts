import { CrmGatewayError } from "../../crm/crm-gateway-error.js";
import type { CrmCoqlQuery, CrmFieldValue, CrmGateway } from "../../crm/crm-gateway.js";
import { escapeCoqlString } from "../artwork/coql.js";
import { NON_RETRYABLE_CODES } from "../artwork/listing/zoho-listing-products.js";
import type {
  EditionLedgerFields,
  PrintProductFields,
  ZohoPrintGroupState,
} from "./plan-print-group.js";

/** The print group's records in Zoho. The mirror depends on this, not on Zoho. */
export interface ZohoPrintModules {
  /** What Zoho holds for the group now; a record that does not exist is null. */
  readGroup(code: string): Promise<ZohoPrintGroupState>;
  /** Creates or updates the group's Print_Products record, matched on its group id. */
  upsertPrintProduct(fields: PrintProductFields): Promise<string>;
  /** Creates or updates the group's Edition_Ledgers record, matched on its mirror key. */
  upsertLedger(fields: EditionLedgerFields): Promise<string>;
}

const PRODUCT_COLUMNS = [
  "id",
  "Print_Group_ID",
  "Total_Edition_Quantity",
  "Collector_Allocation",
  "Artist_Allocation",
  "LAX_Allocation",
  "Edition_Type",
  "Linked_Original_Artwork",
];
const LEDGER_COLUMNS = ["id", "LAX_Mirror_Key", "Linked_Print_Product_Group", "Total_Edition"];

export function printProductQuery(code: string): string {
  return `select ${PRODUCT_COLUMNS.join(", ")} from Print_Products where Print_Group_ID = '${escapeCoqlString(code)}' limit 1`;
}

export function ledgerQuery(mirrorKey: string): string {
  return `select ${LEDGER_COLUMNS.join(", ")} from Edition_Ledgers where LAX_Mirror_Key = '${escapeCoqlString(mirrorKey)}' limit 1`;
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

const count = (value: unknown): number | undefined => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : undefined;
};

/** A lookup arrives as `{ id }` or as the bare id, depending on the query. */
const lookupId = (value: unknown): string | undefined =>
  typeof value === "object" && value !== null ? text((value as { id?: unknown }).id) : text(value);

/** The fields that have a value; a field Zoho returned empty or in another shape is left out. */
function defined<T extends object>(fields: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

function productFrom(row: Record<string, unknown>): ZohoPrintGroupState["printProduct"] {
  const id = text(row.id);
  if (!id) return null;
  const type = text(row.Edition_Type);
  return {
    id,
    fields: defined({
      Print_Group_ID: text(row.Print_Group_ID),
      Total_Edition_Quantity: count(row.Total_Edition_Quantity),
      Collector_Allocation: count(row.Collector_Allocation),
      Artist_Allocation: count(row.Artist_Allocation),
      LAX_Allocation: count(row.LAX_Allocation),
      Edition_Type: type === "Numbered" || type === "Open" ? type : undefined,
      Linked_Original_Artwork: lookupId(row.Linked_Original_Artwork),
    }),
  };
}

function ledgerFrom(row: Record<string, unknown>): ZohoPrintGroupState["ledger"] {
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    fields: defined({
      LAX_Mirror_Key: text(row.LAX_Mirror_Key),
      Linked_Print_Product_Group: lookupId(row.Linked_Print_Product_Group),
      Total_Edition: count(row.Total_Edition),
    }),
  };
}

/** Zoho refused the record: wrong data never succeeds on a retry; anything else may. */
function refused(module: string, code: string | undefined, message: string | undefined) {
  const errorCode = code ?? "EMPTY_RESPONSE";
  const retryable = !NON_RETRYABLE_CODES.has(errorCode);
  return new CrmGatewayError({
    code: errorCode,
    message: `${module} not written: ${message ?? errorCode}`,
    status: retryable ? 503 : 400,
    retryable,
  });
}

/** COQL for the reads and a keyed upsert for the writes, through the shared Zoho stack. */
export class CrmZohoPrintModules implements ZohoPrintModules {
  constructor(private readonly gateway: CrmCoqlQuery & Pick<CrmGateway, "upsert">) {}

  async readGroup(code: string): Promise<ZohoPrintGroupState> {
    const [products, ledgers] = [
      await this.gateway.queryCoql(printProductQuery(code)),
      await this.gateway.queryCoql(ledgerQuery(`group:${code}`)),
    ];
    const product = products.rows[0];
    const ledger = ledgers.rows[0];
    return {
      printProduct: product ? productFrom(product) : null,
      ledger: ledger ? ledgerFrom(ledger) : null,
    };
  }

  upsertPrintProduct(fields: PrintProductFields): Promise<string> {
    const { Linked_Original_Artwork: original, Edition_Type: type, ...rest } = fields;
    return this.write("Print_Products", ["Print_Group_ID"], {
      ...rest,
      ...(type ? { Edition_Type: type } : {}),
      ...(original ? { Linked_Original_Artwork: { id: original } } : {}),
    });
  }

  upsertLedger(fields: EditionLedgerFields): Promise<string> {
    const { Linked_Print_Product_Group: group, ...rest } = fields;
    return this.write("Edition_Ledgers", ["LAX_Mirror_Key"], {
      ...rest,
      Linked_Print_Product_Group: { id: group },
    });
  }

  private async write(
    module: "Print_Products" | "Edition_Ledgers",
    duplicateCheckFields: string[],
    fields: Record<string, CrmFieldValue>,
  ): Promise<string> {
    const result = await this.gateway.upsert({ module, fields, duplicateCheckFields });
    if (result.status !== "success" || !result.recordId) {
      throw refused(module, result.code, result.message);
    }
    return result.recordId;
  }
}
