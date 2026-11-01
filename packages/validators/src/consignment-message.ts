import {
  CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS,
  CONSIGNMENT_MESSAGE_MAX_LENGTH,
} from "@auction/domain";
import { z } from "zod";

/**
 * A message on a consignment's thread: words, files, or both. Lengths are checked again on the
 * normalised text by the domain rule, which also says when nothing was written.
 */
export const postConsignmentMessageBodySchema = z
  .object({
    // A little headroom for spaces the normalised text drops.
    body: z
      .string()
      .max(CONSIGNMENT_MESSAGE_MAX_LENGTH + 200)
      .default(""),
    attachments: z
      .array(
        z
          .object({
            uploadObjectId: z.string().uuid(),
            fileName: z.string().trim().min(1).max(200).nullable().optional(),
          })
          .strict(),
      )
      .max(CONSIGNMENT_MESSAGE_MAX_ATTACHMENTS)
      .default([]),
  })
  .strict();
export type PostConsignmentMessageBody = z.infer<typeof postConsignmentMessageBodySchema>;

export const consignmentThreadSubmissionParamSchema = z.object({
  submissionId: z.string().uuid(),
});

/**
 * The staff inbox: every thread, or those waiting for an answer; one specialist's (`me`, or a
 * user id), or the unassigned; one sale's; newest first, a page at a time.
 */
export const staffConsignmentThreadsQuerySchema = z.object({
  view: z.enum(["all", "unanswered"]).default("all"),
  assigned: z
    .union([z.literal("me"), z.literal("unassigned"), z.string().min(1).max(191)])
    .optional(),
  saleId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(200).optional(),
});
export type StaffConsignmentThreadsQuery = z.infer<typeof staffConsignmentThreadsQuerySchema>;
