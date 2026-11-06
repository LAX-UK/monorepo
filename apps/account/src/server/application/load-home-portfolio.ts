import { cache } from "react";
import { type PortfolioLoad, loadPortfolioItems } from "./load-portfolio-data";

/**
 * The portfolio read for one Home render. Home streams several sections that depend on it (what
 * needs you, the collection, the products, payouts), and sharing one read means the products
 * are asked once however many sections wait on the answer.
 */
export const loadHomePortfolio = cache(loadPortfolioItems);

/**
 * A new person is only recognised when every product answered with nothing: a product that did
 * not answer may be holding their works.
 */
export function isNewPerson(loaded: PortfolioLoad<unknown>): boolean {
  return loaded.status === "ok" && loaded.rows.length === 0 && loaded.complete;
}
