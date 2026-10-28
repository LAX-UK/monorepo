import type { Database } from "@auction/db";
import { shopStaffMember, shopUserProfile } from "@auction/db/schema";
import { roleHasCapability } from "@auction/shop-domain";
import { eq, isNull } from "drizzle-orm";
import type {
  ApplicantDirectory,
  ApplicantImageUploads,
  ArtistApplicationReviewers,
} from "../../application/artist-applications/artist-application.ports.js";
import type { ShopMediaUploadHandlers } from "../../application/handlers/shop-media-upload.handler.js";
import type { ShopMediaAssetRepository } from "../../application/ports/shop-media-asset.repository.js";
import type { ShopStaffMemberReader } from "../../application/ports/staff-member.reader.js";
import { ShopApiError } from "../../errors/shop-api-error.js";

const REVIEW_CAPABILITY = "artist_application.review";

/** The applicant's LAX Account details as Shop's profile projection holds them. */
export function createDrizzleApplicantDirectory(db: Database): ApplicantDirectory {
  return {
    async contactFor(subject) {
      const [profile] = await db
        .select({ email: shopUserProfile.email, name: shopUserProfile.name })
        .from(shopUserProfile)
        .where(eq(shopUserProfile.identitySubjectId, subject))
        .limit(1);
      const email = profile?.email?.trim();
      return {
        email: email?.includes("@") ? email : null,
        name: profile?.name?.trim() || null,
      };
    },
  };
}

/** Active staff whose role carries `artist_application.review`, by name. */
export function createDrizzleArtistApplicationReviewers(
  db: Database,
  staffReader: ShopStaffMemberReader,
): ArtistApplicationReviewers {
  return {
    async list() {
      const staff = await db
        .select({
          subject: shopStaffMember.identitySubjectId,
          role: shopStaffMember.role,
          name: shopUserProfile.name,
          email: shopUserProfile.email,
        })
        .from(shopStaffMember)
        .leftJoin(
          shopUserProfile,
          eq(shopUserProfile.identitySubjectId, shopStaffMember.identitySubjectId),
        )
        .where(isNull(shopStaffMember.disabledAt));
      return staff
        .filter((member) => roleHasCapability(member.role, REVIEW_CAPABILITY))
        .map((member) => ({
          subject: member.subject,
          label: member.name?.trim() || member.email?.trim() || null,
          role: member.role,
        }))
        .sort((a, b) => (a.label ?? a.subject).localeCompare(b.label ?? b.subject, "en-GB"));
    },
    async canReview(subject) {
      const member = await staffReader.findActiveByIdentitySubject(subject);
      return member !== null && roleHasCapability(member.role, REVIEW_CAPABILITY);
    },
  };
}

/**
 * Application images through the shop media uploads: the same signed upload, size and type
 * checks and image probing as catalogue images, under their own kind and key prefix.
 */
export function createApplicantImageUploads(
  handlers: ShopMediaUploadHandlers | null,
  repository: ShopMediaAssetRepository,
): ApplicantImageUploads {
  const configured = (): ShopMediaUploadHandlers => {
    if (!handlers) {
      throw new ShopApiError(
        "shop.policy_not_configured",
        "Image uploads are not available right now",
        503,
      );
    }
    return handlers;
  };
  return {
    async presign({ contentType, byteSize, subjectId }) {
      const signed = await configured().presign({
        kind: "artist_application_image",
        contentType,
        byteSize,
        subjectId,
      });
      return {
        key: signed.key,
        uploadUrl: signed.uploadUrl,
        requiredHeaders: signed.requiredHeaders,
      };
    },
    async confirm(key) {
      const row = await repository.findByKey(key);
      // A retried confirm after a dropped response finds the image already checked.
      if (row?.status === "active") return;
      await configured().confirm({ key, alt: null });
    },
    async ownerOf(key) {
      const row = await repository.findByKey(key);
      if (!row) return null;
      return {
        subjectId: row.createdBySubjectId,
        applicationImage: row.kind === "artist_application_image",
      };
    },
  };
}
