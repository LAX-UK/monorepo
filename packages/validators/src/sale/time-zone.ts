import { LONDON_TIME_ZONE, isPlaceholderZone, isValidZone } from "@auction/datetime";
import { z } from "zod";

/** The zone a sale is scheduled in unless staff choose another. */
export const DEFAULT_SALE_TIME_ZONE = LONDON_TIME_ZONE;

export const SALE_TIME_ZONE_INVALID = "Choose a time zone from the list";
export const SALE_TIME_ZONE_NOT_A_PLACE =
  "Choose the city the sale runs in, not UTC or a fixed offset";

/** Shown beside the locked field, and returned when a published sale's zone is changed. */
export const SALE_TIME_ZONE_LOCKED_MESSAGE =
  "The time zone is fixed once a sale is published, because the times already sent to bidders are quoted in it.";

export type SaleTimeZoneProblem = "unknown" | "not_a_place";

/**
 * Why a value cannot be a sale's official zone, or `null` when it can. An official zone must be
 * a real IANA zone that names a place: UTC and the fixed `Etc/*` zones are what privacy modes
 * report, and no auction is held "in UTC".
 */
export function saleTimeZoneProblem(zone: unknown): SaleTimeZoneProblem | null {
  // Placeholders first: the runtime does not list "UTC" as a place zone, but it is what the person
  // meant, and "Choose the city" is the helpful answer.
  if (typeof zone === "string" && isPlaceholderZone(zone)) return "not_a_place";
  return isValidZone(zone) ? null : "unknown";
}

export function isValidSaleTimeZone(zone: unknown): zone is string {
  return saleTimeZoneProblem(zone) === null;
}

/** Error text for a problem, written for the staff who typed it. */
export function saleTimeZoneMessage(problem: SaleTimeZoneProblem): string {
  return problem === "unknown" ? SALE_TIME_ZONE_INVALID : SALE_TIME_ZONE_NOT_A_PLACE;
}

export const saleTimeZoneSchema = z.string().superRefine((value, ctx) => {
  const problem = saleTimeZoneProblem(value);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: saleTimeZoneMessage(problem) });
});
