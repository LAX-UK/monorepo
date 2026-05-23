import { z } from "zod";

export const veriffDecisionWebhookSchema = z
  .object({
    status: z.string(),
    verification: z
      .object({
        id: z.string(),
        attemptId: z.string().optional().nullable(),
        status: z.string(),
        reasonCode: z.number().optional().nullable(),
        reason: z.string().optional().nullable(),
        decisionTime: z.string().optional().nullable(),
        person: z.record(z.unknown()).optional().nullable(),
        document: z.record(z.unknown()).optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

export const veriffEventWebhookSchema = z
  .object({
    id: z.string(),
    action: z.string(),
    vendorData: z.string().optional().nullable(),
  })
  .passthrough();

export type VeriffDecisionWebhookPayload = z.infer<typeof veriffDecisionWebhookSchema>;
export type VeriffEventWebhookPayload = z.infer<typeof veriffEventWebhookSchema>;

export type VeriffCreateSessionResponse = {
  status: string;
  verification: {
    id: string;
    url: string;
    sessionToken?: string;
  };
};
