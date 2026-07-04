import type { ISaleBiddersReader, SaleBidderRow } from "@auction/persistence";
import type { ISaleExistenceReader } from "./interfaces/sale-follow.js";

export type SaleBiddersPage = {
  items: SaleBidderRow[];
  total: number;
};

export class SaleBiddersService {
  constructor(
    private readonly reader: ISaleBiddersReader,
    private readonly sales: ISaleExistenceReader,
  ) {}

  async list(
    saleId: string,
    opts: { limit: number; offset: number },
  ): Promise<SaleBiddersPage | null> {
    const sale = await this.sales.findById(saleId);
    if (!sale) return null;
    const [items, total] = await Promise.all([
      this.reader.list(saleId, opts),
      this.reader.countDistinct(saleId),
    ]);
    return { items, total };
  }
}
