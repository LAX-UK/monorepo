import type { Auction, CreateAuctionInput } from "@auction/types";
import { err, ok, type Result } from "neverthrow";
import { AuctionError } from "../lib/errors.js";
import type { IAuctionRepository, ListAuctionsFilter } from "./interfaces/repositories.js";

export class AuctionService {
  constructor(private readonly auctionRepo: IAuctionRepository) {}

  async create(
    sellerId: string,
    input: CreateAuctionInput,
  ): Promise<Result<Auction, AuctionError>> {
    if (input.endTime <= input.startTime) {
      return err(new AuctionError("endTime must be after startTime"));
    }
    const created = await this.auctionRepo.create(sellerId, input);
    return ok(created);
  }

  async getById(id: string): Promise<Auction | null> {
    return this.auctionRepo.findById(id);
  }

  async list(filter: ListAuctionsFilter): Promise<Auction[]> {
    return this.auctionRepo.list(filter);
  }
}
