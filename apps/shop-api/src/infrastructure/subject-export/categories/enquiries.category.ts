import { shopArtwork, shopArtworkInterest, shopGeneralEnquiry } from "@auction/db/schema";
import {
  type ExportSource,
  SourcedExportCategory,
} from "@auction/identity-contracts/subject-export-readers";
import { ERASED_ENQUIRY_MESSAGE, isErasedGuestEmail } from "@auction/shop-domain";
import { and, asc, eq } from "drizzle-orm";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { erased, isoRequired, workRef } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

type Origins = SubjectExportDeps["origins"];

const TOPIC_LABEL: Record<string, string> = {
  general: "General enquiry",
  private_viewing: "Private viewing",
  art_advisory: "Art advisory",
  selling: "Selling a work",
  exhibition: "Exhibition enquiry",
  order_problem: "Problem with a Shop order",
};

type Contact = { name: string | null; email: string | null; phone: string | null };

/** Contact details an erasure replaced with a placeholder come back as erased, not as the placeholder. */
function contact({ name, email, phone }: Contact) {
  return email !== null && isErasedGuestEmail(email) ? erased(null) : { name, email, phone };
}

const message = (text: string | null) => (text === ERASED_ENQUIRY_MESSAGE ? erased(null) : text);

/** Staff triage (assignee, internal notes) is not selected; open or closed is all the person sees. */
const status = (closedAt: Date | null) => (closedAt ? "closed" : "open");

export function mapArtworkEnquiry(
  row: {
    id: string;
    reference: string | null;
    message: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    createdAt: Date;
    closedAt: Date | null;
    artworkId: string;
    artworkTitle: string;
    artworkSlug: string;
    salesChannel: "shop" | "art";
  },
  origins: Origins,
) {
  return {
    id: row.id,
    origin: "provided" as const,
    reference: row.reference,
    site: row.salesChannel,
    work: workRef(
      {
        id: row.artworkId,
        title: row.artworkTitle,
        slug: row.artworkSlug,
        salesChannel: row.salesChannel,
      },
      origins,
    ),
    message: message(row.message),
    contact: contact({ name: row.contactName, email: row.contactEmail, phone: row.contactPhone }),
    status: status(row.closedAt),
    sentAt: isoRequired(row.createdAt),
  };
}

export function mapGeneralEnquiry(row: {
  id: string;
  reference: string;
  topic: string;
  message: string;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  createdAt: Date;
  closedAt: Date | null;
}) {
  return {
    id: row.id,
    origin: "provided" as const,
    reference: row.reference,
    // A problem with an order is raised from the Shop; every other topic is asked on lax.art.
    site: row.topic === "order_problem" ? "shop" : "art",
    topic: TOPIC_LABEL[row.topic] ?? row.topic,
    message: message(row.message),
    contact: contact({ name: row.contactName, email: row.contactEmail, phone: row.phone }),
    status: status(row.closedAt),
    sentAt: isoRequired(row.createdAt),
  };
}

export class EnquiriesCategory extends SourcedExportCategory {
  readonly id = "enquiries";
  protected readonly sources: readonly ExportSource[];

  constructor({ db, origins }: SubjectExportDeps) {
    super();
    const ownArtwork = (s: string) =>
      and(eq(shopArtworkInterest.identitySubjectId, s), eq(shopArtworkInterest.intent, "enquiry"));
    this.sources = [
      {
        count: (s) => countWhere(db, shopArtworkInterest, ownArtwork(s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: shopArtworkInterest.id,
              reference: shopArtworkInterest.reference,
              message: shopArtworkInterest.message,
              contactName: shopArtworkInterest.contactName,
              contactEmail: shopArtworkInterest.contactEmail,
              contactPhone: shopArtworkInterest.contactPhone,
              createdAt: shopArtworkInterest.createdAt,
              closedAt: shopArtworkInterest.closedAt,
              artworkId: shopArtwork.id,
              artworkTitle: shopArtwork.title,
              artworkSlug: shopArtwork.slug,
              salesChannel: shopArtwork.salesChannel,
            })
            .from(shopArtworkInterest)
            .innerJoin(shopArtwork, eq(shopArtwork.id, shopArtworkInterest.artworkId))
            .where(and(ownArtwork(s), afterKey(shopArtworkInterest.id, after)))
            .orderBy(asc(shopArtworkInterest.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapArtworkEnquiry(row, origins) }));
        },
      },
      {
        count: (s) =>
          countWhere(db, shopGeneralEnquiry, eq(shopGeneralEnquiry.identitySubjectId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: shopGeneralEnquiry.id,
              reference: shopGeneralEnquiry.reference,
              topic: shopGeneralEnquiry.topic,
              message: shopGeneralEnquiry.message,
              contactName: shopGeneralEnquiry.contactName,
              contactEmail: shopGeneralEnquiry.contactEmail,
              phone: shopGeneralEnquiry.phone,
              createdAt: shopGeneralEnquiry.createdAt,
              closedAt: shopGeneralEnquiry.closedAt,
            })
            .from(shopGeneralEnquiry)
            .where(
              and(
                eq(shopGeneralEnquiry.identitySubjectId, s),
                afterKey(shopGeneralEnquiry.id, after),
              ),
            )
            .orderBy(asc(shopGeneralEnquiry.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapGeneralEnquiry(row) }));
        },
      },
    ];
  }
}
