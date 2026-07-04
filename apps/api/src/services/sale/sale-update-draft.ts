import type { ILotRepository } from "@auction/persistence";
import type { CreateSaleInput, Sale, UserRole } from "@auction/types";
import { normalizeUserStaffRole } from "@auction/types";
import { getSaleModeCapabilities } from "@auction/validators";
import type { updateSaleSchema } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { z } from "zod";
import { canManageCatalogue } from "../../lib/catalogue-auth.js";
import { type AuthzError, LotError, missingCatalogueCapabilityError } from "../../lib/errors.js";
import { lotTimingViolationForSale } from "../../lib/lot-sale-timing.js";
import { enrichPressCoverageWithOpenGraphImages } from "../../lib/press-coverage-enrichment.js";
import { txRepos } from "./sale-mutation-context.js";
import type { SaleServiceDeps } from "./sale-types.js";
import { applyVenueSnapshot } from "./venue-snapshot.js";

export type UpdateSaleBody = z.infer<typeof updateSaleSchema>;

export async function updateDraftSale(
  deps: SaleServiceDeps,
  userRole: string,
  saleId: string,
  patch: UpdateSaleBody,
  userStaffRole?: string | null,
): Promise<Result<Sale, LotError | AuthzError>> {
  const role = userRole as UserRole;
  const staff = normalizeUserStaffRole(userStaffRole ?? undefined);
  if (!canManageCatalogue(role, staff)) {
    return err(
      missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can edit sales",
        role,
        staff,
      ),
    );
  }
  const sale = await deps.saleRepo.findById(saleId);
  if (!sale) return err(new LotError("Sale not found", 404));

  let pressCoverage = patch.pressCoverage;
  if (pressCoverage !== undefined) {
    pressCoverage = await enrichPressCoverageWithOpenGraphImages(sale.pressCoverage, pressCoverage);
  }

  if (sale.status !== "draft") {
    const publishedPatch: Partial<CreateSaleInput> = {};
    if (patch.coverImages !== undefined) publishedPatch.coverImages = patch.coverImages;
    if (patch.title !== undefined) publishedPatch.title = patch.title;
    if (patch.description !== undefined) publishedPatch.description = patch.description;
    const caps = getSaleModeCapabilities(sale.deliveryMode);
    const canEditStreamUrl =
      caps.allowsStreamUrl &&
      (sale.status === "scheduled" || sale.status === "active") &&
      patch.streamUrl !== undefined;
    if (canEditStreamUrl) {
      publishedPatch.streamUrl = patch.streamUrl ?? null;
    }
    // Press coverage: allowed for all delivery modes and all non-draft statuses.
    if (pressCoverage !== undefined) {
      publishedPatch.pressCoverage = pressCoverage;
    }
    // Auction-day media: only allowed for ended onsite/hybrid sales.
    const dayImagesRequested = patch.dayImages !== undefined;
    if (dayImagesRequested) {
      if (!caps.allowsLocation) {
        return err(
          new LotError("Auction day media is only supported for onsite and hybrid sales", 422),
        );
      }
      if (sale.status !== "ended") {
        return err(
          new LotError("Auction day media can only be saved after the sale has ended", 422),
        );
      }
      publishedPatch.dayImages = patch.dayImages;
    }
    if (Object.keys(publishedPatch).length === 0) {
      return err(new LotError("Only draft sales can be edited"));
    }
    const updated = await deps.saleRepo.update(saleId, publishedPatch);
    if (patch.coverImages !== undefined) {
      await deps.imageCleanup?.enqueueRemovedMany(sale.coverImages, patch.coverImages);
    }
    if (dayImagesRequested && patch.dayImages !== undefined) {
      // Collect all keys (video poster keys too) for cleanup.
      const prevKeys = (sale.dayImages ?? []).flatMap((r) => {
        const keys = [r.key];
        if (r.mediaType === "video" && "posterKey" in r && r.posterKey) keys.push(r.posterKey);
        return keys;
      });
      const nextKeys = patch.dayImages.flatMap((r) => {
        const keys = [r.key];
        if (r.mediaType === "video" && "posterKey" in r && r.posterKey) keys.push(r.posterKey);
        return keys;
      });
      await deps.imageCleanup?.enqueueRemovedMany(prevKeys, nextKeys);
    }
    return ok(updated);
  }
  const nextStart = patch.startTime ?? sale.startTime;
  const nextEnd = patch.endTime ?? sale.endTime;
  if (nextEnd <= nextStart) {
    return err(new LotError("endTime must be after startTime"));
  }
  let normalized: Partial<CreateSaleInput> = { ...(patch as Partial<CreateSaleInput>) };
  if (pressCoverage !== undefined) {
    normalized = { ...normalized, pressCoverage };
  }
  const nextDelivery = patch.deliveryMode ?? sale.deliveryMode;
  const caps = getSaleModeCapabilities(nextDelivery);
  if (!caps.allowsStreamUrl) {
    normalized.streamUrl = null;
  }
  if (!caps.allowsLocation) {
    normalized.locationName = null;
    normalized.locationAddress = null;
    normalized.locationMapUrl = null;
    normalized.locationAddressLine1 = null;
    normalized.locationAddressLine2 = null;
    normalized.locationCity = null;
    normalized.locationCounty = null;
    normalized.locationPostcode = null;
    normalized.locationCountry = null;
    normalized.venueId = null;
  } else {
    const saleLegalEntityId =
      sale.createdByLegalEntityId ?? (await deps.resolvePlatformCatalogLegalEntityId());
    if (!saleLegalEntityId) {
      return err(new LotError("Sale legal entity is not configured", 400));
    }
    const snapshot = await applyVenueSnapshot(deps.venueRepository, normalized, {
      saleLegalEntityId,
      existingVenueId: sale.venueId ?? null,
      snapshotAddress: false,
    });
    if (snapshot.isErr()) return err(snapshot.error);
    normalized = snapshot.value;
  }
  if (caps.inheritsLotTiming) {
    const lots = await deps.lotRepo.findBySaleId(saleId);
    const syncDraftLots = async (lotRepo: ILotRepository) => {
      for (const l of lots) {
        if (l.status === "draft") {
          await lotRepo.update(l.id, { startTime: nextStart, endTime: nextEnd });
        }
      }
    };
    if (deps.transactionRunner && deps.repoFactory) {
      const updated = await deps.transactionRunner.runInTransaction(async (tx) => {
        const lotRepo = txRepos(deps, tx).lot;
        const saleRepo = txRepos(deps, tx).sale;
        await syncDraftLots(lotRepo);
        return saleRepo.update(saleId, normalized);
      });
      if (patch.coverImages !== undefined) {
        await deps.imageCleanup?.enqueueRemovedMany(sale.coverImages, patch.coverImages);
      }
      return ok(updated);
    }
    await syncDraftLots(deps.lotRepo);
  } else if (patch.startTime !== undefined || patch.endTime !== undefined) {
    const lots = await deps.lotRepo.findBySaleId(saleId);
    const nextSale = {
      ...sale,
      deliveryMode: nextDelivery,
      startTime: nextStart,
      endTime: nextEnd,
    };
    const violations: string[] = [];
    for (const l of lots) {
      const violation = lotTimingViolationForSale(nextSale, l.startTime, l.endTime);
      if (violation) {
        violations.push(`${violation} (lot "${l.title}")`);
      }
    }
    if (violations.length > 0) {
      return err(new LotError(violations.join("; "), 400));
    }
  }
  const updated = await deps.saleRepo.update(saleId, normalized);
  if (patch.coverImages !== undefined) {
    await deps.imageCleanup?.enqueueRemovedMany(sale.coverImages, patch.coverImages);
  }
  if (normalized.dayImages !== undefined) {
    const prevKeys = (sale.dayImages ?? []).flatMap((r) => {
      const keys = [r.key];
      if (r.mediaType === "video" && "posterKey" in r && r.posterKey) keys.push(r.posterKey);
      return keys;
    });
    const nextKeys = normalized.dayImages.flatMap((r) => {
      const keys = [r.key];
      if (r.mediaType === "video" && "posterKey" in r && r.posterKey) keys.push(r.posterKey);
      return keys;
    });
    await deps.imageCleanup?.enqueueRemovedMany(prevKeys, nextKeys);
  }
  return ok(updated);
}
