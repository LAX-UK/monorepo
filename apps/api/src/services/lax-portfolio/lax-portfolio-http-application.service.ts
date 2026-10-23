import type { IBidPortfolioReader } from "@auction/persistence/interfaces";
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
  mediaUrlResolver: IMediaUrlResolver;
  webOrigin: string;
  legalName: string;
};

export class LaxPortfolioHttpApplicationService implements IUserLaxPortfolioHttpApplicationService {
  constructor(private readonly deps: LaxPortfolioHttpDeps) {}

  async getPortfolio(input: { userId: string }): Promise<UserHttpJson> {
    const facts = await this.deps.reader.loadForPerson(input.userId);
    const keys = [
      ...facts.wonLots.map((lot) => lot.firstImageKey),
      ...facts.submissions.map((submission) => submission.firstImageKey),
      ...facts.sellerLots.map((lot) => lot.firstImageKey),
    ].filter((key): key is string => key !== null);
    const urls = await this.deps.mediaUrlResolver.resolveManyUnique([...new Set(keys)]);
    const items = buildBidPortfolioItems(facts, {
      ...this.context(),
      imageUrl: (key) => (key === null ? null : (urls.get(key) ?? null)),
    });
    return { status: 200, body: { items } };
  }

  async getMoney(input: { userId: string }): Promise<UserHttpJson> {
    const facts = await this.deps.reader.loadForPerson(input.userId);
    const entries = buildBidMoneyEntries(facts, { ...this.context(), imageUrl: () => null });
    return { status: 200, body: { entries } };
  }

  private context(): Omit<BidPortfolioContext, "imageUrl"> {
    return { webOrigin: this.deps.webOrigin, legalName: this.deps.legalName };
  }
}
