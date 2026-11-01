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
