import { AbsenteeBidService as RuntimeAbsenteeBidService } from "@auction/bidding-runtime";
import type { IAbsenteeBidRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { IBidRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import type { Bid } from "@auction/types";
import type { Result } from "neverthrow";
import type {
  AbsenteeBidServiceError,
  IAbsenteeBidService,
} from "./interfaces/absentee-bid-service.js";
import type { IBidPlacer, PlaceBidInput } from "./interfaces/place-bid.js";

export type { AbsenteeBidServiceError } from "./interfaces/absentee-bid-service.js";

function toBidPlacer(bidService: IBidPlacer): import("@auction/bidding-runtime").IBidPlacer {
  return {
    placeBid: (input) =>
      bidService.placeBid(input as PlaceBidInput) as Promise<
        Result<Bid, import("@auction/bidding-runtime").BidPlacementError>
      >,
  };
}

/** API-facing absentee service; delegates replay/scheduling to shared bidding runtime. */
export class AbsenteeBidService implements IAbsenteeBidService {
  private readonly inner: RuntimeAbsenteeBidService;

  constructor(
    absenteeBidRepo: IAbsenteeBidRepository,
    bidService: IBidPlacer,
    lotRepo: ILotRepository,
    legalEntityRepository: ILegalEntityRepository | null,
    bidRepo: IBidRepository | null = null,
  ) {
    this.inner = new RuntimeAbsenteeBidService(
      absenteeBidRepo,
      toBidPlacer(bidService),
      lotRepo,
      legalEntityRepository,
      bidRepo,
    );
  }

  schedule(
    input: Parameters<IAbsenteeBidService["schedule"]>[0],
  ): Promise<Result<{ id: string }, AbsenteeBidServiceError>> {
    return this.inner.schedule(input);
  }

  expireStaleExecutingLeases(): Promise<void> {
    return this.inner.expireStaleExecutingLeases();
  }

  replayScheduledForLot(lotId: string): Promise<void> {
    return this.inner.replayScheduledForLot(lotId);
  }
}

/** @deprecated use AbsenteeBidService — kept for tests importing runtime directly */
export { RuntimeAbsenteeBidService };
