import { isUkPostcode, normalizeUkPostcode } from "@auction/validators";
import { z } from "zod";

const upsertBasketLineQuantitySchema = z.number().int().min(1).max(24);

export const upsertBasketLineBodySchema = z.union([
  z
    .object({
      artworkSlug: z.string().min(1),
      quantity: upsertBasketLineQuantitySchema,
    })
    .strict(),
  z
    .object({
      productVariantId: z.string().uuid(),
      quantity: upsertBasketLineQuantitySchema,
    })
    .strict(),
]);

export const DELIVERY_PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,19}$/;

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
      deliveryPhone: z
        .string()
        .min(8)
        .max(20)
        .regex(DELIVERY_PHONE_PATTERN, "Enter a valid delivery phone number")
        .optional(),
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
      if (body.fulfilment === "uk_insured_delivery" && body.deliveryAddress) {
        const phone = body.deliveryPhone?.trim();
        if (!phone) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Delivery phone is required",
            path: ["deliveryPhone"],
          });
        } else if (!DELIVERY_PHONE_PATTERN.test(phone)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Enter a valid delivery phone number",
            path: ["deliveryPhone"],
          });
        }
      }
      if (
        body.fulfilment === "uk_insured_delivery" &&
        body.deliveryAddress &&
        !isUkPostcode(body.deliveryAddress.postcode)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid UK postcode",
          path: ["deliveryAddress", "postcode"],
        });
      }
    })
    .transform((body) => {
      if (body.fulfilment !== "uk_insured_delivery" || !body.deliveryAddress) {
        return body;
      }
      return {
        ...body,
        deliveryAddress: {
          ...body.deliveryAddress,
          postcode: normalizeUkPostcode(body.deliveryAddress.postcode),
        },
      };
    });
}

export const checkoutBodySchema = createCheckoutBodySchema("http://localhost:3020");
