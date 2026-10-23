import type { LaxResourceId } from "@auction/identity-contracts";
import type { LaxMoneyEntryV1, LaxPortfolioItemV1 } from "@auction/lax-ecosystem";
import type { SourceResults } from "../domain/portfolio-sources";
import type { StaffSessionRecord } from "./session-store";

/** The signed-in session a read acts for; its id is where exchanged tokens are cached. */
export type SessionHandle = { sessionId: string; record: StaffSessionRecord };

export type ResourceTokenProvider = {
  /** A read-only access token whose audience is `resource`. Throws when none can be issued. */
  tokenFor(handle: SessionHandle, resource: LaxResourceId): Promise<string>;
};

/**
 * Reads a person's works and money from every product that holds them. Each product answers
 * independently: one that fails or times out is reported as unavailable and never hides the rest.
 */
export type PortfolioGateway = {
  readPortfolio(handle: SessionHandle): Promise<SourceResults<LaxPortfolioItemV1>>;
  readMoney(handle: SessionHandle): Promise<SourceResults<LaxMoneyEntryV1>>;
};
