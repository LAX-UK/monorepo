import type { Sale } from "@auction/types";
import type { CreateSaleInput as ValidatorCreateSale } from "@auction/validators";
import { englishOnlyAdminLotAuctionTypeViolation } from "@auction/validators";
import { LotError } from "../../lib/errors.js";
import { resolveLotTimingForSale } from "../../lib/lot-sale-timing.js";
import { publishSaleEvent, recordLotLifecycle, txRepos } from "./sale-mutation-context.js";
import type { SaleServiceDeps } from "./sale-types.js";
import { applyVenueSnapshot } from "./venue-snapshot.js";

export async function createSale(
  deps: SaleServiceDeps,
  adminId: string,
  input: ValidatorCreateSale,
): Promise<Sale> {
  if (input.endTime <= input.startTime) {
    throw new LotError("endTime must be after startTime");
  }
  const createdByLegalEntityId = await deps.resolvePlatformCatalogLegalEntityId();
  if (!createdByLegalEntityId) {
    throw new LotError(
      "Platform catalog legal entity is not configured. Reseed the dev database (pnpm --filter @auction/db db:seed:dev) and restart the API.",
      400,
    );
  }
  const snapshot = await applyVenueSnapshot(deps.venueRepository, input, {
    saleLegalEntityId: createdByLegalEntityId,
    snapshotAddress: false,
  });
  if (snapshot.isErr()) throw snapshot.error;
  const normalizedInput = { ...input, ...snapshot.value };
  const sale = await deps.saleRepo.create({ ...normalizedInput, createdByLegalEntityId });
  await deps.qrCodeService?.getOrCreateDefault({
    entityType: "sale",
    entityId: sale.id,
    actorUserId: adminId,
  });
  if (input.lots?.length) {
    for (const row of input.lots) {
      const lockMsg = englishOnlyAdminLotAuctionTypeViolation({
        enabled: deps.englishOnlyAuctions,
        requested: row.auctionType,
      });
      if (lockMsg) {
        throw new LotError(lockMsg);
      }
      const { sellerId, ...lotFields } = row;
      const resolved = resolveLotTimingForSale(sale, lotFields.startTime, lotFields.endTime);
      if (!resolved.ok) {
        throw new LotError(resolved.message, 400);
      }
      if (deps.db && deps.lotLifecycleRecording) {
        const created = await deps.db.transaction(async (tx) => {
          const lotRepo = txRepos(deps, tx).lot;
          const created = await lotRepo.create({
            ...lotFields,
            sellerLegalEntityId: sellerId,
            startTime: resolved.startTime,
            endTime: resolved.endTime,
            saleId: sale.id,
          });
          await deps.lotLifecycleRecording?.recordCreated(tx, {
            lot: created,
            source: "sale_create",
          });
          return created;
        });
        await deps.qrCodeService?.getOrCreateDefault({
          entityType: "lot",
          entityId: created.id,
          actorUserId: adminId,
        });
      } else {
        const created = await deps.lotRepo.create({
          ...lotFields,
          sellerLegalEntityId: sellerId,
          startTime: resolved.startTime,
          endTime: resolved.endTime,
          saleId: sale.id,
        });
        await recordLotLifecycle(deps, async (tx) => {
          await deps.lotLifecycleRecording?.recordCreated(tx, {
            lot: created,
            source: "sale_create",
          });
        });
        await deps.qrCodeService?.getOrCreateDefault({
          entityType: "lot",
          entityId: created.id,
          actorUserId: adminId,
        });
      }
    }
  }
  await publishSaleEvent(deps, adminId, sale.id, "sale.created", {
    from_status: null,
    to_status: sale.status,
    deliveryMode: sale.deliveryMode,
    lotCount: input.lots?.length ?? 0,
  });
  return sale;
}
