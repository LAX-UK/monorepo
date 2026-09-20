import { z } from "zod";

export const upsertBasketLineBodySchema = z.object({
  artworkSlug: z.string().min(1),
  quantity: z.number().int().min(1).max(24),
});

const deliveryAddressSchema = z.object({
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  postcode: z.string().min(1).max(32),
  country: z.string().min(2).max(2),
});

export function createCheckoutBodySchema(storefrontOrigin: string) {
  return z
    .object({
      basketId: z.string().uuid(),
      fulfilment: z.string().min(1),
      idempotencyKey: z.string().min(8).max(128),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
      deliveryAddress: deliveryAddressSchema.optional(),
    })
    .superRefine((body, ctx) => {
      for (const field of ["successUrl", "cancelUrl"] as const) {
        try {
          const origin = new URL(body[field]).origin;
          if (origin !== storefrontOrigin) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Redirect URL must stay on the storefront",
              path: [field],
            });
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid redirect URL",
            path: [field],
          });
        }
      }
      if (body.fulfilment === "uk_insured_delivery" && !body.deliveryAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Delivery address is required",
          path: ["deliveryAddress"],
        });
      }
    });
}

export const checkoutBodySchema = createCheckoutBodySchema("http://localhost:3020");
