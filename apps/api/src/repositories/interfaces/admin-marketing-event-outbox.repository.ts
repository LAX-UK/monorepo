import type { marketingEventOutbox } from "@auction/db/schema";

export type MarketingEventOutboxState = (typeof marketingEventOutbox.$inferSelect)["state"];

export type MarketingEventOutboxStatsRow = {
  name: string;
  state: MarketingEventOutboxState;
  count: number;
};

export type MarketingEventOutboxFailedHourRow = {
  name: string;
  count: number;
};

export interface IAdminMarketingEventOutboxRepository {
  countReplayCandidates(input: {
    from: Date;
    to: Date;
    states: MarketingEventOutboxState[];
    names?: string[] | undefined;
  }): Promise<number>;
  listReplayCandidateIds(input: {
    from: Date;
    to: Date;
    states: MarketingEventOutboxState[];
    names?: string[] | undefined;
    limit: number;
  }): Promise<string[]>;
  requeueByIds(ids: string[]): Promise<number>;
  statsSince(since: Date): Promise<MarketingEventOutboxStatsRow[]>;
  failedLastHour(windowMs: number): Promise<MarketingEventOutboxFailedHourRow[]>;
}
