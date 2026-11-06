import type { IBidPortfolioReader } from "@auction/persistence/interfaces";
import type { IAmountsOwedService } from "../interfaces/amounts-owed.js";
import type { IMediaUrlResolver } from "../interfaces/media-url-resolver.js";
import type { IUserLaxPortfolioHttpApplicationService } from "../interfaces/user-routes/user-lax-portfolio-http.js";
import type { UserHttpJson } from "../interfaces/user-routes/user-route-http.js";
import {
  type BidPortfolioContext,
  buildBidMoneyEntries,
  buildBidPortfolioItems,
} from "./bid-portfolio.adapter.js";

export type LaxPortfolioHttpDeps = {
  reader: IBidPortfolioReader;
  amountsOwed: Pick<IAmountsOwedService, "forPerson">;
  mediaUrlResolver: IMediaUrlResolver;
  webOrigin: string;
  legalName: string;
};

export class LaxPortfolioHttpApplicationService implements IUserLaxPortfolioHttpApplicationService {
  constructor(private readonly deps: LaxPortfolioHttpDeps) {}

  async getPortfolio(input: { userId: string }): Promise<UserHttpJson> {
    const { facts, owed } = await this.loadFactsAndOwed(input.userId);
    const keys = [
      ...facts.wonLots.map((lot) => lot.firstImageKey),
      ...facts.submissions.map((submission) => submission.firstImageKey),
      ...facts.sellerLots.map((lot) => lot.firstImageKey),
    ].filter((key): key is string => key !== null);
    const urls = await this.deps.mediaUrlResolver.resolveManyUnique([...new Set(keys)]);
    const items = buildBidPortfolioItems(
      facts,
      {
        ...this.context(),
        imageUrl: (key) => (key === null ? null : (urls.get(key) ?? null)),
      },
      owed,
    );
    return { status: 200, body: { items } };
  }

  async getMoney(input: { userId: string }): Promise<UserHttpJson> {
    const { facts, owed } = await this.loadFactsAndOwed(input.userId);
    const entries = buildBidMoneyEntries(facts, { ...this.context(), imageUrl: () => null }, owed);
    return { status: 200, body: { entries } };
  }

  /** Portfolio and Money read the same facts and the same amounts owed, so they cannot disagree. */
  private async loadFactsAndOwed(userId: string) {
    const [facts, owed] = await Promise.all([
      this.deps.reader.loadForPerson(userId),
      this.deps.amountsOwed.forPerson(userId),
    ]);
    return { facts, owed: new Map(owed.entries.map((entry) => [entry.lotId, entry])) };
  }

  private context(): Omit<BidPortfolioContext, "imageUrl"> {
    return { webOrigin: this.deps.webOrigin, legalName: this.deps.legalName };
  }
}
