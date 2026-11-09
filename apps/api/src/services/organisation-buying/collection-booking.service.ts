import {
  type CollectionBookingOffer,
  type CollectionBookingSettings,
  accountPurchaseScope,
  collectionBookingOffer,
  collectionSettingsFromPlace,
  summariseWeeklyHours,
} from "@auction/domain";
import type {
  IAccountPurchaseFactsReader,
  ICollectionPlaceRepository,
} from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import type {
  BuyingResult,
  ICollectionBookingService,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { buyingError, entityActorOf } from "./purchase-view.js";

/** Where a won lot is collected from, as one line (the sale's venue). */
export interface ICollectionPlaceLookup {
  placeForLot(lotId: string): Promise<string | null>;
}

/**
 * How to book a collection for a purchase the member can see. The booking route itself is a
 * domain rule over the place's settings, so self-serve slots open only once staff switch them on.
 * A place set up in Bid admin decides for itself (its switch, capacity and hours); a place that
 * has not been set up keeps using the environment settings.
 */
export class CollectionBookingService implements ICollectionBookingService {
  constructor(
    private readonly deps: {
      /** The environment's settings: the fallback for a place that has not been set up. */
      settings: CollectionBookingSettings;
      collectionPlaces: Pick<ICollectionPlaceRepository, "findForLot">;
      purchases: IAccountPurchaseFactsReader;
      places: ICollectionPlaceLookup;
    },
  ) {}

  async offer(actor: OrganisationMemberActor, lotId: string): BuyingResult<CollectionBookingOffer> {
    const scope = accountPurchaseScope(entityActorOf(actor));
    if (!scope) return err(buyingError("insufficient_entity_role"));
    const [row] = await this.deps.purchases.list({
      legalEntityId: actor.legalEntityId,
      memberUserId: scope === "own" ? actor.userId : null,
      lotIds: [lotId],
      limit: 1,
      offset: 0,
    });
    if (!row) return err(buyingError("purchase_not_found"));
    return ok(
      collectionBookingOffer(
        await this.settingsFor(lotId),
        await this.deps.places.placeForLot(lotId),
      ),
    );
  }

  private async settingsFor(lotId: string): Promise<CollectionBookingSettings> {
    const place = await this.deps.collectionPlaces.findForLot(lotId);
    if (!place) return this.deps.settings;
    return collectionSettingsFromPlace(
      place.settings,
      summariseWeeklyHours(place.hours),
      this.deps.settings,
    );
  }
}
