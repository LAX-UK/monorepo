import {
  EMAIL_BLOCK_REASONS,
  EMAIL_LIFT_REASONS,
  EMAIL_SEND_STATUSES,
  type EmailProviderResult,
  type PersonEmailDeliveryView,
} from "@auction/types";
import { z } from "zod";

const sendEvent = z.object({
  type: z.enum(["delivered", "bounce", "soft_bounce", "complaint", "unsubscribe"]),
  receivedAt: z.string(),
});

const liftAvailability = z.union([
  z.object({ allowed: z.literal(true) }),
  z.object({ allowed: z.literal(false), reason: z.string() }),
]);

export const personEmailDeliverySchema: z.ZodType<PersonEmailDeliveryView> = z.object({
  addressStatus: z.enum(["ok", "bounced", "complained"]),
  lastDeliveredAt: z.string().nullable(),
  alerts: z.object({ state: z.enum(["on", "off", "stopped_after_complaint"]) }).nullable(),
  block: z
    .object({
      reason: z.enum(EMAIL_BLOCK_REASONS),
      since: z.string(),
      providerDetail: z.string().nullable(),
      stopsEssentialEmail: z.boolean(),
      liftReasons: z.array(z.enum(EMAIL_LIFT_REASONS)),
      noteRequired: z.boolean(),
      writtenRequestRequired: z.boolean(),
      lift: liftAvailability,
    })
    .nullable(),
  sends: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      essential: z.boolean(),
      product: z.enum(["bid", "shop", "art", "account"]),
      status: z.enum(EMAIL_SEND_STATUSES),
      createdAt: z.string(),
      sentAt: z.string().nullable(),
      events: z.array(sendEvent),
    }),
  ),
});

export const liftEmailBlockResultSchema: z.ZodType<{ provider: EmailProviderResult }> = z.object({
  provider: z.union([
    z.object({ status: z.literal("queued") }),
    z.object({ status: z.literal("not_needed") }),
    z.object({ status: z.literal("still_blocked"), message: z.string() }),
  ]),
});
