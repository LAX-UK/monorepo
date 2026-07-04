import type { Lot, Sale, UserRole } from "@auction/types";
import { normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import {
  getSaleModeCapabilities,
  isOnsiteLocationPopulated,
  isStartInFutureForPublish,
} from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { AuthzError, LotError } from "../../lib/errors.js";
import { assertLotPublishable } from "../../lib/lot-publish-policy.js";
import { resolveLotTimingForSale } from "../../lib/lot-sale-timing.js";
import { findLotsMissingSellerConnect } from "../../lib/seller-connect-readiness.js";
import { recordLotLifecycle, txRepos } from "./sale-mutation-context.js";
import { getByIdWithLots } from "./sale-read.js";
import type { SaleServiceDeps } from "./sale-types.js";
import { applyVenueSnapshot } from "./venue-snapshot.js";

export type PublishReadinessBundle = {
  sale: Sale;
  lots: Lot[];
  caps: ReturnType<typeof getSaleModeCapabilities>;
};

export async function assertCanPublishSale(
  userRole: string,
  userStaffRole: string | null | undefined,
): Promise<Result<void, AuthzError>> {
  if (
    !roleHasCapability(
      userRole as UserRole,
      "auction.manage",
      normalizeUserStaffRole(userStaffRole ?? undefined),
    )
  ) {
    return err(new AuthzError("Only staff with auction.manage can publish sales", 403));
  }
  return ok(undefined);
}

export async function validatePublishReadiness(
  deps: SaleServiceDeps,
  saleId: string,
): Promise<Result<PublishReadinessBundle, LotError>> {
  const bundle = await getByIdWithLots(deps, saleId);
  if (!bundle) return err(new LotError("Sale not found", 404));
  const { sale, lots } = bundle;
  if (sale.status !== "draft") {
    return err(new LotError("Only draft sales can be published"));
  }
  if (!isStartInFutureForPublish(sale.startTime)) {
    return err(new LotError("startTime must be in the future to publish"));
  }
  if (lots.length === 0) {
    return err(new LotError("Sale must have at least one lot to publish"));
  }

  const caps = getSaleModeCapabilities(sale.deliveryMode);

  for (const l of lots) {
    if (l.status !== "draft") {
      return err(new LotError("All lots in the sale must be draft to publish"));
    }
    const publishable = assertLotPublishable(l, {
      sale,
      requireCatalogue: true,
      rejectDraftSale: false,
    });
    if (!publishable.ok) {
      const error = publishable.error;
      return err(new LotError(`${error.message} (lot "${l.title}")`, error.status, error.code));
    }
  }

  if (deps.enforceIndividualConnectOnPublish && deps.legalEntityRepository) {
    const blocked = await findLotsMissingSellerConnect(lots, deps.legalEntityRepository);
    if (blocked.length > 0) {
      const titles = blocked.map((l) => `"${l.title}"`).join(", ");
      return err(
        new LotError(
          blocked.length === 1
            ? `This seller must complete Stripe Connect onboarding before the lot can be scheduled. (lot ${titles})`
            : `Sellers must complete Stripe Connect onboarding before publish (${blocked.length} lots: ${titles})`,
          409,
          "connect_required",
        ),
      );
    }
  }

  return ok({ sale, lots, caps });
}

export async function applyVenueSnapshotForPublish(
  deps: SaleServiceDeps,
  saleId: string,
  bundle: PublishReadinessBundle,
): Promise<Result<PublishReadinessBundle, LotError>> {
  let { sale, lots, caps } = bundle;
  if (!caps.allowsLocation || !sale.venueId) {
    if (caps.allowsLocation && !isOnsiteLocationPopulated(sale)) {
      return err(
        new LotError(
          "Onsite sales require a saved venue or venue name with address before publish",
          400,
          "onsite_location_required",
        ),
      );
    }
    return ok(bundle);
  }

  const saleLegalEntityId =
    sale.createdByLegalEntityId ?? (await deps.resolvePlatformCatalogLegalEntityId());
  if (!saleLegalEntityId) {
    return err(new LotError("Sale legal entity is not configured", 400));
  }
  const snapshot = await applyVenueSnapshot(
    deps.venueRepository,
    { venueId: sale.venueId },
    {
      saleLegalEntityId,
      existingVenueId: sale.venueId,
      snapshotAddress: true,
    },
  );
  if (snapshot.isErr()) return err(snapshot.error);
  sale = await deps.saleRepo.update(saleId, snapshot.value);
  lots = await deps.lotRepo.findBySaleId(saleId);

  if (caps.allowsLocation && !isOnsiteLocationPopulated(sale)) {
    return err(
      new LotError(
        "Onsite sales require a saved venue or venue name with address before publish",
        400,
        "onsite_location_required",
      ),
    );
  }

  return ok({ sale, lots, caps });
}

export async function scheduleSaleLotsForPublish(
  deps: SaleServiceDeps,
  saleId: string,
  userId: string,
  bundle: PublishReadinessBundle,
): Promise<void> {
  const { sale, lots, caps } = bundle;

  if (deps.transactionRunner && deps.lotLifecycleRecording) {
    await deps.transactionRunner.runInTransaction(async (tx) => {
      const saleRepo = txRepos(deps, tx).sale;
      const lotRepo = txRepos(deps, tx).lot;
      if (caps.inheritsLotTiming) {
        for (const l of lots) {
          const resolved = resolveLotTimingForSale(sale, l.startTime, l.endTime);
          if (
            resolved.ok &&
            (resolved.startTime.getTime() !== l.startTime.getTime() ||
              resolved.endTime.getTime() !== l.endTime.getTime())
          ) {
            await lotRepo.update(l.id, {
              startTime: resolved.startTime,
              endTime: resolved.endTime,
            });
          }
        }
      }
      await saleRepo.updateStatus(saleId, "scheduled");
      for (const l of lots) {
        await lotRepo.updateStatus(l.id, "scheduled");
        const row = await lotRepo.findById(l.id);
        if (!row) throw new LotError("Lot not found", 404);
        await deps.lotLifecycleRecording?.recordPublished(tx, row, userId);
      }
    });
  } else {
    if (caps.inheritsLotTiming) {
      for (const l of lots) {
        const resolved = resolveLotTimingForSale(sale, l.startTime, l.endTime);
        if (
          resolved.ok &&
          (resolved.startTime.getTime() !== l.startTime.getTime() ||
            resolved.endTime.getTime() !== l.endTime.getTime())
        ) {
          await deps.lotRepo.update(l.id, {
            startTime: resolved.startTime,
            endTime: resolved.endTime,
          });
        }
      }
    }
    await deps.saleRepo.updateStatus(saleId, "scheduled");
    for (const l of lots) {
      await deps.lotRepo.updateStatus(l.id, "scheduled");
      await recordLotLifecycle(deps, async (tx) => {
        await deps.lotLifecycleRecording?.recordPublished(
          tx,
          { ...l, status: "scheduled" },
          userId,
        );
      });
    }
  }
}

export function lotScheduleWindowForPublish(
  bundle: PublishReadinessBundle,
  lot: Lot,
): { lotStart: Date; lotEnd: Date } {
  const { sale, caps } = bundle;
  return {
    lotStart: caps.inheritsLotTiming ? sale.startTime : lot.startTime,
    lotEnd: caps.inheritsLotTiming ? sale.endTime : lot.endTime,
  };
}
