export const COQL_PAGE_SIZE = 200;

const PRODUCT_FIELDS = [
  "id",
  "Product_Name",
  "Reference_Stock_Code",
  "Artist",
  "Medium",
  "Dimensions",
  "Status",
  "Year",
  "Unit_Price",
  "Modified_Time",
].join(", ");

const ARTIST_FIELDS = ["id", "Name", "Artist_Code1", "Artist_Code2"].join(", ");

/** Zoho reads times as ISO 8601 with an offset and no fraction. */
export function formatCoqlTime(value: Date): string {
  return `${value.toISOString().slice(0, 19)}+00:00`;
}

export function escapeCoqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Products changed after a time, oldest first. Without a time every Product is read, which is the
 * full pass behind the first import report.
 */
export function productsModifiedSinceQuery(
  since: Date | null,
  offset: number,
  pageSize: number = COQL_PAGE_SIZE,
): string {
  const after = formatCoqlTime(since ?? new Date(0));
  return `select ${PRODUCT_FIELDS} from Products where Modified_Time > '${after}' order by Modified_Time limit ${offset}, ${pageSize}`;
}

export function productByIdQuery(id: string): string {
  return `select ${PRODUCT_FIELDS} from Products where id = '${escapeCoqlString(id)}' limit 1`;
}

/** The two fields LAX writes, read before a write so a value Zoho already holds is not sent again. */
export function productWriteStateQuery(id: string): string {
  return `select id, Status, Reference_Stock_Code from Products where id = '${escapeCoqlString(id)}' limit 1`;
}

export function artistsQuery(offset: number, pageSize: number = COQL_PAGE_SIZE): string {
  return `select ${ARTIST_FIELDS} from Artists where id is not null order by id limit ${offset}, ${pageSize}`;
}
