import type { CrmCoqlQuery, CrmGateway, CrmModule } from "../../crm/crm-gateway.js";
import { escapeCoqlString } from "../artwork/coql.js";
import type { ZohoFields, ZohoRecordState } from "./plan-order.js";
import { refused } from "./zoho-print-modules.js";

/** The Zoho modules the order mirror writes. */
export type OrderModule = Extract<
  CrmModule,
  "Print_Products" | "Edition_Ledgers" | "Print_SKUs" | "Dispatch_Fulfilments"
>;

/** The order mirror's records in Zoho. The mirror depends on this, not on Zoho. */
export interface ZohoOrderRecords {
  /** The one record whose `keyField` holds `key`, with the columns asked for; null when none. */
  find(
    module: OrderModule,
    keyField: string,
    key: string,
    columns: readonly string[],
  ): Promise<ZohoRecordState | null>;
  /**
   * Updates the record with this id; without an id, creates it, or updates the one whose
   * `matchOn` field already holds the same value (another delivery may have made it since the
   * find). Answers the record's id.
   */
  save(
    module: OrderModule,
    id: string | null,
    fields: ZohoFields,
    matchOn?: string,
  ): Promise<string>;
}

const API_NAME = /^[A-Za-z][A-Za-z0-9_]{0,99}$/;

/** A column read back for comparing: a lookup as its id, text trimmed, numbers as they are. */
function columnValue(value: unknown): unknown {
  if (typeof value === "object" && value !== null) return (value as { id?: unknown }).id;
  return typeof value === "string" ? value.trim() : value;
}

export function findQuery(
  module: OrderModule,
  keyField: string,
  key: string,
  columns: readonly string[],
): string {
  for (const name of [keyField, ...columns]) {
    // Field names come from code and config, never from data; anything else is refused outright.
    if (!API_NAME.test(name)) throw new Error(`zoho_field_name_invalid:${name}`);
  }
  const select = ["id", ...columns.filter((c) => c !== "id")].join(", ");
  return `select ${select} from ${module} where ${keyField} = '${escapeCoqlString(key)}' limit 1`;
}

/**
 * COQL for the reads; updates by id, and keyed upserts for new records, through the shared Zoho
 * stack. Two deliveries of one order may both find no record; the upsert lets the second update
 * the record the first made instead of being refused as a duplicate.
 */
export class CrmZohoOrderRecords implements ZohoOrderRecords {
  constructor(
    private readonly gateway: CrmCoqlQuery &
      Pick<CrmGateway, "createRecord" | "updateById" | "upsert">,
  ) {}

  async find(
    module: OrderModule,
    keyField: string,
    key: string,
    columns: readonly string[],
  ): Promise<ZohoRecordState | null> {
    const page = await this.gateway.queryCoql(findQuery(module, keyField, key, columns));
    const row = page.rows[0];
    const id = typeof row?.id === "string" ? row.id : undefined;
    if (!row || !id) return null;
    return {
      id,
      fields: Object.fromEntries(columns.map((column) => [column, columnValue(row[column])])),
    };
  }

  async save(
    module: OrderModule,
    id: string | null,
    fields: ZohoFields,
    matchOn?: string,
  ): Promise<string> {
    if (matchOn !== undefined && !API_NAME.test(matchOn)) {
      throw new Error(`zoho_field_name_invalid:${matchOn}`);
    }
    const result = id
      ? await this.gateway.updateById({ module, recordId: id, fields })
      : matchOn
        ? await this.gateway.upsert({ module, fields, duplicateCheckFields: [matchOn] })
        : await this.gateway.createRecord({ module, fields });
    if (result.status !== "success" || !(result.recordId || id)) {
      throw refused(module, result.code, result.message);
    }
    return result.recordId || (id as string);
  }
}
