import { ALL_QUEUE_NAMES } from "@auction/queues/registry";
import { z } from "zod";

const queueNameSchema = z.enum(ALL_QUEUE_NAMES as [string, ...string[]]);

export const adminQueueNameParamSchema = z.object({
  name: queueNameSchema,
});

export const adminQueueJobIdParamSchema = z.object({
  name: queueNameSchema,
  jobId: z.string().min(1),
});

export const adminQueueDlqJobIdParamSchema = z.object({
  jobId: z.string().min(1),
});

export const adminQueueJobsQuerySchema = z.object({
  status: z
    .enum(["waiting", "active", "completed", "failed", "delayed", "paused"])
    .default("failed"),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

export const adminQueueReplayDlqBodySchema = z.object({
  confirmIdempotency: z.literal(true),
});
