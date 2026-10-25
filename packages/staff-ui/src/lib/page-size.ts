/** The page sizes every staff list offers. */
export const STAFF_PAGE_SIZES = [25, 50, 100] as const;
/** Every staff list shows 50 rows a page until the person picks otherwise. */
export const STAFF_DEFAULT_PAGE_SIZE = 50;

/**
 * A page size from the URL: one of the offered sizes, else the default. Lists read it with this
 * so a hand-edited `?limit=5000` cannot ask the API for more than a page.
 */
export function parseStaffPageSize(value: unknown): number {
  const size = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  return (STAFF_PAGE_SIZES as readonly number[]).includes(size) ? size : STAFF_DEFAULT_PAGE_SIZE;
}
