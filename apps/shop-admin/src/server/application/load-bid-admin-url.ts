import { loadStaffProducts } from "./load-staff-products";

/**
 * Where Bid admin lives, for a person Bid says can open it; null for everyone else and whenever
 * Bid cannot say. A link into Bid admin is only drawn when this has an answer.
 */
export async function loadBidAdminUrl(): Promise<string | null> {
  const products = await loadStaffProducts();
  return products.find((product) => product.id === "bid-admin")?.href ?? null;
}
