import type {
  ISaleExistenceReader,
  ISaleFollowRepository,
  SaleFollowRow,
} from "./interfaces/sale-follow.js";

export class SaleFollowService {
  constructor(
    private readonly repo: ISaleFollowRepository,
    private readonly sales: ISaleExistenceReader,
  ) {}

  async follow(userId: string, saleId: string): Promise<SaleFollowRow | null> {
    const sale = await this.sales.findById(saleId);
    if (!sale) return null;
    return this.repo.add(userId, saleId);
  }

  async unfollow(userId: string, saleId: string): Promise<void> {
    await this.repo.remove(userId, saleId);
  }

  isFollowing(userId: string, saleId: string): Promise<boolean> {
    return this.repo.exists(userId, saleId);
  }

  count(saleId: string): Promise<number> {
    return this.repo.countForSale(saleId);
  }
}
