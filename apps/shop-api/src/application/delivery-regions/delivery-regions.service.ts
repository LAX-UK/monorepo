import {
  DELIVERY_REGIONS_EDIT_CAPABILITY,
  type DeliveryRegionEdit,
  type DeliveryRegionId,
  deliveryRegionIssues,
  restrictedCountryIssues,
} from "@auction/shop-domain";
import { DeliveryRegionsRejectedError } from "../../errors/delivery-regions-rejected-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type {
  DeliveryRegionsReader,
  DeliveryRegionsState,
  DeliveryRegionsUnitOfWork,
} from "./delivery-regions.ports.js";

export type UpdateDeliveryRegionCommand = {
  id: DeliveryRegionId;
  edit: DeliveryRegionEdit;
  actorSubjectId: string;
  idempotencyKey: string;
};

export type ReplaceRestrictedCountriesCommand = {
  codes: readonly string[];
  actorSubjectId: string;
  idempotencyKey: string;
};

const sorted = (codes: readonly string[]) => [...new Set(codes)].sort();

/**
 * Where the Shop delivers. Reading is open; a save is checked by the domain rules (whole working
 * days, minimum not above maximum, a sensible price, real countries), applied at once, audited
 * with the values before and after, and replayed for a repeated idempotency key. Checkout does
 * not read any of this yet.
 */
export function createDeliveryRegionsService(deps: {
  uow: DeliveryRegionsUnitOfWork;
  reader: DeliveryRegionsReader;
  clock: { now(): Date };
}) {
  return {
    read(): Promise<DeliveryRegionsState> {
      return deps.reader.read();
    },

    updateRegion(command: UpdateDeliveryRegionCommand): Promise<DeliveryRegionsState> {
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "delivery_regions.update_region",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: { id: command.id, edit: command.edit },
          run: async () => {
            const issues = deliveryRegionIssues({ id: command.id }, command.edit);
            if (issues.length > 0) throw new DeliveryRegionsRejectedError("region", issues);
            await tx.store.lock();
            const before = (await tx.store.read()).regions.find((r) => r.id === command.id);
            await tx.store.saveRegion({
              id: command.id,
              edit: command.edit,
              actorSubjectId: command.actorSubjectId,
              at: deps.clock.now(),
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: DELIVERY_REGIONS_EDIT_CAPABILITY,
              action: "delivery_regions.update_region",
              targetType: "shop_delivery_region",
              targetId: command.id,
              beforeJson: before
                ? {
                    standard: before.standard,
                    specialist: before.specialist,
                    fixedPricePence: before.fixedPricePence,
                  }
                : {},
              afterJson: { ...command.edit },
            });
            return tx.store.read();
          },
        }),
      );
    },

    replaceRestrictedCountries(
      command: ReplaceRestrictedCountriesCommand,
    ): Promise<DeliveryRegionsState> {
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "delivery_regions.replace_restricted",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: { codes: command.codes },
          run: async () => {
            const issues = restrictedCountryIssues(command.codes);
            if (issues.length > 0) throw new DeliveryRegionsRejectedError("countries", issues);
            await tx.store.lock();
            const before = (await tx.store.read()).restrictedCountries;
            await tx.store.replaceRestrictedCountries(sorted(command.codes));
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: DELIVERY_REGIONS_EDIT_CAPABILITY,
              action: "delivery_regions.replace_restricted",
              targetType: "shop_delivery_restricted_country",
              targetId: "all",
              beforeJson: { countries: before },
              afterJson: { countries: sorted(command.codes) },
            });
            return tx.store.read();
          },
        }),
      );
    },
  };
}

export type DeliveryRegionsService = ReturnType<typeof createDeliveryRegionsService>;
