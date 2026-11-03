import { z } from "zod";

/** The topics a Bid person can switch; Shop and lax.art validate their own. */
export const bidAlertTopicSchema = z.enum(["bid.new_sales", "bid.artists", "bid.searches"]);

export const alertSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,60}$/)
    .optional(),
});

export const alertTokenSchema = z.object({
  token: z.string().min(1).max(2048),
});

/** Stopping from the stop page or a mail app's one-click button. */
export const alertStopSchema = z
  .object({
    token: z.string().min(1).max(2048),
    scope: z.enum(["all", "topic"]).default("all"),
    topic: bidAlertTopicSchema.optional(),
    via: z.enum(["page", "one_click"]).default("page"),
  })
  .refine((v) => v.scope === "all" || v.topic !== undefined, {
    message: "topic is required when scope is topic",
    path: ["topic"],
  });

/**
 * `on` subscribes (or leaves the subscription, with the topic's email off when `email` is false).
 * `email` defaults to the same as `on`.
 */
export const alertTopicSwitchSchema = z.object({ on: z.boolean(), email: z.boolean().optional() });

export type AlertSignupInput = z.infer<typeof alertSignupSchema>;
