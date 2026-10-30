import type {
  BiddingExposureCommitmentRow,
  IOrganisationBiddingLimitReader,
  IOrganisationBiddingLimitWriter,
  OrganisationBiddingLimitRecord,
} from "@auction/persistence/interfaces";
import { vi } from "vitest";
import { OrganisationBiddingLimitsService } from "../services/bidding-limits/organisation-bidding-limits.service.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import {
  InMemoryBuyerAgentAuthorisations,
  NOW,
  OPEN_SALE_ID,
} from "./in-memory-buyer-agent-authorisations.js";

/** One organisation limit per entity, as the database keeps it. */
export class InMemoryOrganisationBiddingLimits
  implements IOrganisationBiddingLimitReader, IOrganisationBiddingLimitWriter
{
  readonly rows = new Map<string, OrganisationBiddingLimitRecord>();

  async find(legalEntityId: string) {
    return this.rows.get(legalEntityId) ?? null;
  }

  async set(input: { legalEntityId: string; limitAmount: string; setByUserId: string }) {
    const previous = this.rows.get(input.legalEntityId)?.limitAmount ?? null;
    this.rows.set(input.legalEntityId, { ...input, updatedAt: NOW });
    return { previousAmount: previous };
  }

  async clear(legalEntityId: string) {
    const previous = this.rows.get(legalEntityId)?.limitAmount ?? null;
    this.rows.delete(legalEntityId);
    return { previousAmount: previous };
  }
}

/**
 * The organisation's open commitments in these tests: one lot with a leading bid under a
 * maximum, an absentee bid in another sale, and an unpaid win. Exposure is 30,000.
 */
export const SAMPLE_COMMITMENTS: BiddingExposureCommitmentRow[] = [
  { lotId: "l1", saleId: OPEN_SALE_ID, userId: "agent-1", kind: "leading_bid", amount: "6000.00" },
  { lotId: "l1", saleId: OPEN_SALE_ID, userId: "agent-1", kind: "maximum_bid", amount: "9000.00" },
  { lotId: "l2", saleId: "other-sale", userId: "agent-1", kind: "absentee_bid", amount: "1000.00" },
  { lotId: "l3", saleId: null, userId: "owner-1", kind: "unpaid_win", amount: "20000.00" },
];

/** The service over in-memory limits and authorisations, with a spy event sink. */
export function buildOrganisationBiddingLimitsService() {
  const limits = new InMemoryOrganisationBiddingLimits();
  const authorisations = new InMemoryBuyerAgentAuthorisations();
  const publish = vi.fn().mockResolvedValue(undefined);
  const events: IDomainEventSink = { publish, withTx: () => events };
  const service = new OrganisationBiddingLimitsService({
    limits,
    exposure: { listCommitments: async () => SAMPLE_COMMITMENTS },
    authorisations,
    events,
    now: () => NOW,
  });
  return { service, limits, authorisations, publish };
}
