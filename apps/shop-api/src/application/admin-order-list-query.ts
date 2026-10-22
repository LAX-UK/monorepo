import { type AdminOrderListQuery, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopApiError } from "../errors/shop-api-error.js";
import type { AdminOrderListInput } from "./ports/admin-readers.js";

function validation(message: string): ShopApiError {
  return new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, message, 400);
}

/** The schema checks the shape; this rejects shapes that are not real days, such as 2026-02-30. */
function isCalendarDay(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** Validates the filters and drops blanks, so the repository only sees filters that narrow. */
export function parseOrderListQuery(query: AdminOrderListQuery): AdminOrderListInput {
  for (const [field, value] of [
    ["createdFrom", query.createdFrom],
    ["createdTo", query.createdTo],
  ] as const) {
    if (value !== undefined && !isCalendarDay(value)) {
      throw validation(`${field} must be a real calendar date (YYYY-MM-DD)`);
    }
  }
  if (query.createdFrom && query.createdTo && query.createdFrom > query.createdTo) {
    throw validation("createdFrom must not be after createdTo");
  }
  const q = query.q?.trim();
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.createdFrom ? { createdFrom: query.createdFrom } : {}),
    ...(query.createdTo ? { createdTo: query.createdTo } : {}),
    ...(q ? { q } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.limit ? { limit: query.limit } : {}),
  };
}
