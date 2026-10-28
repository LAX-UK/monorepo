import type { Database } from "@auction/db";
import { createArtistApplicantService } from "../../application/artist-applications/artist-applicant.service.js";
import { createArtistApplicationRateLimiters } from "../../application/artist-applications/artist-application-rate-limits.js";
import { createArtistApplicationReviewService } from "../../application/artist-applications/artist-application-review.service.js";
import type { Clock } from "../../application/artist-applications/artist-application.ports.js";
import type { ShopMediaUploadHandlers } from "../../application/handlers/shop-media-upload.handler.js";
import type { FixedWindowCounter } from "../../application/ports/fixed-window-counter.js";
import type { ShopMediaAssetRepository } from "../../application/ports/shop-media-asset.repository.js";
import type { ShopUnitOfWorkFactory } from "../../application/ports/shop-unit-of-work.js";
import type { ShopStaffMemberReader } from "../../application/ports/staff-member.reader.js";
import {
  createApplicantImageUploads,
  createDrizzleArtistApplicationReviewers,
} from "./artist-application-adapters.js";
import { createDrizzleArtistApplicationQueueReader } from "./drizzle-artist-application-queue.reader.js";
import { createDrizzleArtistApplicationUnitOfWork } from "./drizzle-artist-application.unit-of-work.js";
import { artistApplicationLinks } from "./outbox-artist-application.notifier.js";

const systemClock: Clock = { now: () => new Date() };

/** Wires the applicant and review services to Postgres, the media store and the rate counter. */
export function createArtistApplicationServices(deps: {
  db: Database;
  uow: ShopUnitOfWorkFactory;
  resolveMediaUrl: (value: string | null | undefined) => string | null;
  mediaUploads: ShopMediaUploadHandlers | null;
  mediaAssets: ShopMediaAssetRepository;
  staffReader: ShopStaffMemberReader;
  rateLimitCounter: FixedWindowCounter;
  /** lax.art's public address, which the emails link to. */
  artPublicUrl: string;
  onRateLimitUnavailable: (error: unknown) => void;
}) {
  const uow = createDrizzleArtistApplicationUnitOfWork(deps.uow, {
    resolveMediaUrl: deps.resolveMediaUrl,
    links: artistApplicationLinks(deps.artPublicUrl),
    clock: systemClock,
  });
  return {
    applicant: createArtistApplicantService({
      uow,
      uploads: createApplicantImageUploads(deps.mediaUploads, deps.mediaAssets),
      rateLimiters: createArtistApplicationRateLimiters(deps.rateLimitCounter),
      clock: systemClock,
      onRateLimitUnavailable: deps.onRateLimitUnavailable,
    }),
    review: createArtistApplicationReviewService({
      uow,
      queue: createDrizzleArtistApplicationQueueReader(deps.db, {
        resolveMediaUrl: deps.resolveMediaUrl,
      }),
      reviewers: createDrizzleArtistApplicationReviewers(deps.db, deps.staffReader),
      clock: systemClock,
    }),
  };
}
