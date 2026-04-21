import { z } from "zod";

/** Dashboard “Bidding preferences” (subset of notification prefs + optional client-only max bid hint). */
export const biddingPreferencesPatchSchema = z.object({
  outbidInApp: z.boolean().optional(),
  outbidPush: z.boolean().optional(),
  endingSoonPush: z.boolean().optional(),
  defaultMaxBidAmount: z.string().max(32).nullable().optional(),
});

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
