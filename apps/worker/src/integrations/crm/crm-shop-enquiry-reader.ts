import type { Database } from "@auction/db";
import {
  artworkRegister,
  bidIdentityDirectory,
  shopArtwork,
  shopArtworkInterest,
  shopUserProfile,
} from "@auction/db/schema";
import { and, eq } from "drizzle-orm";

/** What staff need on the Lead of a signed-in person who enquired about a Shop original. */
export type CrmShopEnquiryRecord = {
  email: string;
  name: string | null;
  phone: string | null;
  /** The enquiry reference the sender quotes; null for an enquiry stored without one. */
  reference: string | null;
  artworkTitle: string;
  artworkSlug: string;
  /** The register stock code of the work, when it has one. */
  stockCode: string | null;
};

export interface CrmShopEnquiryReader {
  find(input: { artworkId: string; subjectId: string }): Promise<CrmShopEnquiryRecord | null>;
}

export function createDrizzleCrmShopEnquiryReader(db: Database): CrmShopEnquiryReader {
  return {
    async find({ artworkId, subjectId }) {
      const [work] = await db
        .select({ title: shopArtwork.title, slug: shopArtwork.slug })
        .from(shopArtwork)
        .where(eq(shopArtwork.id, artworkId))
        .limit(1);
      if (!work) return null;
      const [profile] = await db
        .select({ email: shopUserProfile.email, name: shopUserProfile.name })
        .from(shopUserProfile)
        .where(eq(shopUserProfile.identitySubjectId, subjectId))
        .limit(1);
      const [identity] = await db
        .select({ email: bidIdentityDirectory.email, name: bidIdentityDirectory.name })
        .from(bidIdentityDirectory)
        .where(eq(bidIdentityDirectory.subjectId, subjectId))
        .limit(1);
      // The identity directory is the account's current address; the Shop profile is a copy.
      const email = identity?.email ?? profile?.email;
      if (!email) return null;
      const [interest] = await db
        .select({
          reference: shopArtworkInterest.reference,
          phone: shopArtworkInterest.contactPhone,
        })
        .from(shopArtworkInterest)
        .where(
          and(
            eq(shopArtworkInterest.artworkId, artworkId),
            eq(shopArtworkInterest.identitySubjectId, subjectId),
            eq(shopArtworkInterest.intent, "enquiry"),
          ),
        )
        .limit(1);
      const [entry] = await db
        .select({ stockCode: artworkRegister.stockCode })
        .from(artworkRegister)
        .where(
          and(
            eq(artworkRegister.offerRefKind, "shop_artwork"),
            eq(artworkRegister.offerRefId, artworkId),
          ),
        )
        .limit(1);
      return {
        email,
        name: identity?.name ?? profile?.name ?? null,
        phone: interest?.phone ?? null,
        reference: interest?.reference ?? null,
        artworkTitle: work.title,
        artworkSlug: work.slug,
        stockCode: entry?.stockCode ?? null,
      };
    },
  };
}
