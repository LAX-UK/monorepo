import {
  shopArtistApplication,
  shopArtistApplicationWork,
  shopArtwork,
  shopMediaAsset,
  shopSaleAuthorityRequest,
} from "@auction/db/schema";
import type { SubjectExportFileRef } from "@auction/identity-contracts";
import {
  type ExportSource,
  SourcedExportCategory,
} from "@auction/identity-contracts/subject-export-readers";
import { and, asc, eq, inArray } from "drizzle-orm";
import { resolvePortalPartyIds } from "../../portal-party-ids.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { iso, isoRequired, workRef } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

type Origins = SubjectExportDeps["origins"];

export type ApplicationRow = {
  id: string;
  reference: string;
  status: string;
  artistName: string | null;
  location: string | null;
  website: string | null;
  socialLinks: string[];
  shortBio: string | null;
  statement: string | null;
  representation: string | null;
  exhibitions: string | null;
  consentToContact: boolean;
  contactEmail: string | null;
  messageToArtist: string | null;
  submittedAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
};

export type ApplicationWork = {
  title: string | null;
  year: number | null;
  medium: string | null;
  size: string | null;
  kind: string | null;
  image: SubjectExportFileRef | null;
};

/**
 * What the artist wrote, the latest note from LAX that the artist can read, and the decision. The
 * reviewer assigned, the review history and staff identities are not selected.
 */
export function mapApplication(row: ApplicationRow, works: readonly ApplicationWork[]) {
  return {
    id: `application:${row.id}`,
    origin: "provided" as const,
    kind: "artist_application",
    submittedAt: isoRequired(row.submittedAt ?? row.createdAt),
    details: {
      reference: row.reference,
      artistName: row.artistName,
      location: row.location,
      website: row.website,
      socialLinks: row.socialLinks,
      shortBio: row.shortBio,
      statement: row.statement,
      representation: row.representation,
      exhibitions: row.exhibitions,
      consentToContact: row.consentToContact,
      contactEmail: row.contactEmail,
      works,
      messageFromLax: row.messageToArtist,
    },
    status: row.status,
    decidedAt: iso(row.decidedAt),
  };
}

export function mapSaleAuthorityRequest(
  row: {
    id: string;
    requestedCount: number;
    note: string | null;
    declineReason: string | null;
    status: string;
    handledAt: Date | null;
    createdAt: Date;
    artworkId: string;
    artworkTitle: string;
    artworkSlug: string;
    salesChannel: "shop" | "art";
  },
  origins: Origins,
) {
  return {
    id: `sale-authority:${row.id}`,
    origin: "provided" as const,
    kind: "sale_authority_request",
    submittedAt: isoRequired(row.createdAt),
    details: {
      work: workRef(
        {
          id: row.artworkId,
          title: row.artworkTitle,
          slug: row.artworkSlug,
          salesChannel: row.salesChannel,
        },
        origins,
      ),
      requestedCount: row.requestedCount,
      note: row.note,
      messageFromLax: row.declineReason,
    },
    status: row.status,
    decidedAt: iso(row.handledAt),
  };
}

/**
 * Artist applications and sale-authority requests the person made. A person who never applied has
 * none, and the category is then empty. Payout and sale ledgers are LAX's accounting records and
 * are not part of this category.
 */
export class SellingCategory extends SourcedExportCategory {
  readonly id = "selling";
  protected readonly sources: readonly ExportSource[];

  constructor({ db, files, origins }: SubjectExportDeps) {
    super();
    this.sources = [
      {
        count: (s) =>
          countWhere(db, shopArtistApplication, eq(shopArtistApplication.applicantSubjectId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: shopArtistApplication.id,
              reference: shopArtistApplication.reference,
              status: shopArtistApplication.status,
              artistName: shopArtistApplication.artistName,
              location: shopArtistApplication.location,
              website: shopArtistApplication.website,
              socialLinks: shopArtistApplication.socialLinks,
              shortBio: shopArtistApplication.shortBio,
              statement: shopArtistApplication.statement,
              representation: shopArtistApplication.representation,
              exhibitions: shopArtistApplication.exhibitions,
              consentToContact: shopArtistApplication.consentToContact,
              contactEmail: shopArtistApplication.contactEmail,
              messageToArtist: shopArtistApplication.messageToArtist,
              submittedAt: shopArtistApplication.submittedAt,
              decidedAt: shopArtistApplication.decidedAt,
              createdAt: shopArtistApplication.createdAt,
            })
            .from(shopArtistApplication)
            .where(
              and(
                eq(shopArtistApplication.applicantSubjectId, s),
                afterKey(shopArtistApplication.id, after),
              ),
            )
            .orderBy(asc(shopArtistApplication.id))
            .limit(limit);
          if (rows.length === 0) return [];
          const workRows = await db
            .select({
              applicationId: shopArtistApplicationWork.applicationId,
              mediaKey: shopArtistApplicationWork.mediaKey,
              title: shopArtistApplicationWork.title,
              year: shopArtistApplicationWork.year,
              medium: shopArtistApplicationWork.medium,
              size: shopArtistApplicationWork.size,
              kind: shopArtistApplicationWork.kind,
              contentType: shopMediaAsset.contentType,
              byteSize: shopMediaAsset.byteSize,
            })
            .from(shopArtistApplicationWork)
            .innerJoin(shopMediaAsset, eq(shopMediaAsset.key, shopArtistApplicationWork.mediaKey))
            .where(
              inArray(
                shopArtistApplicationWork.applicationId,
                rows.map((row) => row.id),
              ),
            )
            .orderBy(asc(shopArtistApplicationWork.position));
          const works = await Promise.all(
            workRows.map(async (work) => ({
              applicationId: work.applicationId,
              work: {
                title: work.title,
                year: work.year,
                medium: work.medium,
                size: work.size,
                kind: work.kind,
                image: await files.sign({
                  keyOrUrl: work.mediaKey,
                  fileName: work.mediaKey.split("/").pop() || "image",
                  contentType: work.contentType,
                  byteSize: work.byteSize,
                }),
              } satisfies ApplicationWork,
            })),
          );
          return rows.map((row) => ({
            key: row.id,
            record: mapApplication(
              row,
              works.filter((entry) => entry.applicationId === row.id).map((entry) => entry.work),
            ),
          }));
        },
      },
      {
        count: async (s) => {
          const partyIds = await resolvePortalPartyIds(db, s);
          return partyIds.length === 0
            ? 0
            : countWhere(
                db,
                shopSaleAuthorityRequest,
                inArray(shopSaleAuthorityRequest.ownerPartyId, partyIds),
              );
        },
        page: async (s, after, limit) => {
          const partyIds = await resolvePortalPartyIds(db, s);
          if (partyIds.length === 0) return [];
          const rows = await db
            .select({
              id: shopSaleAuthorityRequest.id,
              requestedCount: shopSaleAuthorityRequest.requestedCount,
              note: shopSaleAuthorityRequest.note,
              declineReason: shopSaleAuthorityRequest.declineReason,
              status: shopSaleAuthorityRequest.status,
              handledAt: shopSaleAuthorityRequest.handledAt,
              createdAt: shopSaleAuthorityRequest.createdAt,
              artworkId: shopArtwork.id,
              artworkTitle: shopArtwork.title,
              artworkSlug: shopArtwork.slug,
              salesChannel: shopArtwork.salesChannel,
            })
            .from(shopSaleAuthorityRequest)
            .innerJoin(shopArtwork, eq(shopArtwork.id, shopSaleAuthorityRequest.artworkId))
            .where(
              and(
                inArray(shopSaleAuthorityRequest.ownerPartyId, partyIds),
                afterKey(shopSaleAuthorityRequest.id, after),
              ),
            )
            .orderBy(asc(shopSaleAuthorityRequest.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapSaleAuthorityRequest(row, origins),
          }));
        },
      },
    ];
  }
}
