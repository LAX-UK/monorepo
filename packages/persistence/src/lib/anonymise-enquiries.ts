import type { Database } from "@auction/db";
import {
  marketingEnquiry,
  marketingEnquiryAttachment,
  marketingEnquiryNote,
  privateSaleDeal,
  privateSaleEnquiryDetail,
  uploadObject,
} from "@auction/db/schema";
import { ERASED_ENQUIRY, isEnquiryHeldFromErasure } from "@auction/domain";
import type { PrivateSaleDealStage } from "@auction/types";
import { and, inArray, ne, or, sql } from "drizzle-orm";
import type {
  EnquiryErasureCounts,
  EnquiryErasureTarget,
} from "../interfaces/enquiry-erasure.repository.js";

const NONE: EnquiryErasureCounts = { enquiries: 0, notes: 0, attachments: 0, held: 0 };

/** Which enquiries the target covers. An empty list of accounts covers nothing. */
function targetCondition(target: EnquiryErasureTarget) {
  if (target.kind === "email") {
    return sql`lower(${marketingEnquiry.email}) = ${target.email.trim().toLowerCase()}`;
  }
  if (target.userIds.length === 0) return null;
  return inArray(marketingEnquiry.userId, [...target.userIds]);
}

/**
 * Replaces the sender's details on their enquiries and removes what they sent in. The enquiry row
 * itself stays, with its reference, intent, department, status, routing and dates, so staff
 * records and counts are unchanged. Files are detached and their upload records expire now, so
 * the existing clean-up of unclaimed enquiry files deletes the stored object and the record.
 */
export async function anonymiseEnquiries(
  tx: Database,
  target: EnquiryErasureTarget,
): Promise<EnquiryErasureCounts> {
  const condition = targetCondition(target);
  if (!condition) return { ...NONE };

  const matched = await tx
    .select({ id: marketingEnquiry.id, status: marketingEnquiry.status })
    .from(marketingEnquiry)
    .where(condition);
  const dealStages = await dealStagesOf(
    tx,
    matched.filter((row) => row.status === "converted").map((row) => row.id),
  );
  const isHeld = (row: { id: string; status: string }) =>
    isEnquiryHeldFromErasure(row.status, dealStages.get(row.id) ?? []);
  const held = matched.filter(isHeld).length;
  const ids = matched.filter((row) => !isHeld(row)).map((row) => row.id);
  if (ids.length === 0) return { ...NONE, held };

  const attachments = await detachFiles(tx, ids);

  const notes = await tx
    .update(marketingEnquiryNote)
    .set({ body: ERASED_ENQUIRY.note })
    .where(
      and(
        inArray(marketingEnquiryNote.enquiryId, ids),
        ne(marketingEnquiryNote.body, ERASED_ENQUIRY.note),
      ),
    )
    .returning({ id: marketingEnquiryNote.id });

  await tx
    .update(privateSaleEnquiryDetail)
    .set({ locationTown: null, locationCountry: null, lookingFor: null })
    .where(inArray(privateSaleEnquiryDetail.enquiryId, ids));

  const enquiries = await tx
    .update(marketingEnquiry)
    .set({
      name: ERASED_ENQUIRY.name,
      email: ERASED_ENQUIRY.email,
      phone: null,
      message: ERASED_ENQUIRY.message,
      version: sql`${marketingEnquiry.version} + 1`,
    })
    .where(
      and(
        inArray(marketingEnquiry.id, ids),
        or(
          ne(marketingEnquiry.name, ERASED_ENQUIRY.name),
          ne(marketingEnquiry.email, ERASED_ENQUIRY.email),
          ne(marketingEnquiry.message, ERASED_ENQUIRY.message),
          sql`${marketingEnquiry.phone} IS NOT NULL`,
        ),
      ),
    )
    .returning({ id: marketingEnquiry.id });

  return {
    enquiries: enquiries.length,
    notes: notes.length,
    attachments,
    held,
  };
}

/** The stage of every deal made from each of the enquiries, so a finished deal releases its hold. */
async function dealStagesOf(
  tx: Database,
  enquiryIds: readonly string[],
): Promise<Map<string, PrivateSaleDealStage[]>> {
  const stages = new Map<string, PrivateSaleDealStage[]>();
  if (enquiryIds.length === 0) return stages;
  const deals = await tx
    .select({ enquiryId: privateSaleDeal.sourceEnquiryId, stage: privateSaleDeal.stage })
    .from(privateSaleDeal)
    .where(inArray(privateSaleDeal.sourceEnquiryId, [...enquiryIds]));
  for (const deal of deals) {
    if (!deal.enquiryId) continue;
    const list = stages.get(deal.enquiryId) ?? [];
    list.push(deal.stage as PrivateSaleDealStage);
    stages.set(deal.enquiryId, list);
  }
  return stages;
}

/** Detaches the files from the enquiries and lets the unclaimed-file clean-up remove them. */
async function detachFiles(tx: Database, enquiryIds: readonly string[]): Promise<number> {
  const removed = await tx
    .delete(marketingEnquiryAttachment)
    .where(inArray(marketingEnquiryAttachment.enquiryId, [...enquiryIds]))
    .returning({ uploadObjectId: marketingEnquiryAttachment.uploadObjectId });
  if (removed.length === 0) return 0;
  await tx
    .update(uploadObject)
    .set({ expiresAt: sql`least(${uploadObject.expiresAt}, now())` })
    .where(
      inArray(
        uploadObject.id,
        removed.map((row) => row.uploadObjectId),
      ),
    );
  return removed.length;
}
