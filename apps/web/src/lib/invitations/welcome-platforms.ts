import { LAX_STAFF_PLATFORMS, type LaxStaffAccessProduct } from "@auction/types";

/** Reads `?platforms=bid,shop` into known platforms in catalogue order. */
export function parseWelcomePlatforms(raw: string | string[] | undefined): LaxStaffAccessProduct[] {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const requested = new Set(value.split(",").map((p) => p.trim()));
  return LAX_STAFF_PLATFORMS.map((p) => p.product).filter((p) => requested.has(p));
}
