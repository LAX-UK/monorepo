import { z } from "zod";

export const notificationPreferencePatchSchema = z.object({
  outbidInApp: z.boolean().optional(),
  wonInApp: z.boolean().optional(),
  lostInApp: z.boolean().optional(),
  endingSoonInApp: z.boolean().optional(),
  watchlistInApp: z.boolean().optional(),
  paymentInApp: z.boolean().optional(),
  outbidPush: z.boolean().optional(),
  wonPush: z.boolean().optional(),
  endingSoonPush: z.boolean().optional(),
  quietStart: z.string().nullable().optional(),
  quietEnd: z.string().nullable().optional(),
});

export const pushSubscriptionBodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const pushUnsubscribeBodySchema = z.object({
  endpoint: z.string().min(1),
});
