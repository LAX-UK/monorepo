import type { LaxMoneyEntryV1, LaxPortfolioItemV1 } from "@auction/lax-ecosystem";
import { getLaxAccountContainer } from "../container";
import { type ComposedRows, composeSources } from "../domain/portfolio-composition";
import type { SourceResults } from "../domain/portfolio-sources";
import type { SessionHandle } from "../ports/portfolio-gateway";
import { loadAccountSessionHandle } from "./load-account-record";

export type PortfolioLoad<Row> =
  | ({ status: "ok" } & ComposedRows<Row>)
  | { status: "unsigned" }
  /** The session store could not be reached, so who is signed in is unknown. */
  | { status: "unavailable" };

async function load<Row>(
  read: (handle: SessionHandle) => Promise<SourceResults<Row>>,
): Promise<PortfolioLoad<Row>> {
  try {
    const handle = await loadAccountSessionHandle();
    if (!handle) return { status: "unsigned" };
    return { status: "ok", ...composeSources(await read(handle)) };
  } catch (error) {
    // A Redis outage must not look like a sign-out, as in loadAccountSession.
    console.error("account_portfolio_load_failed", error);
    return { status: "unavailable" };
  }
}

/** The person's works from every product, with which products could not answer in full. */
export function loadPortfolioItems(): Promise<PortfolioLoad<LaxPortfolioItemV1>> {
  return load((handle) => getLaxAccountContainer().portfolio.readPortfolio(handle));
}

/** The person's money from every product, with which products could not answer in full. */
export function loadMoneyEntries(): Promise<PortfolioLoad<LaxMoneyEntryV1>> {
  return load((handle) => getLaxAccountContainer().portfolio.readMoney(handle));
}
