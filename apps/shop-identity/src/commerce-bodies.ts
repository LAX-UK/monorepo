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
  recipientName: z.string().trim().min(1).max(200).optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  postcode: z.string().min(1).max(32),
  country: z.string().min(2).max(2),
});

const checkoutBodyShape = {
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
};

type CheckoutBodyCommon = z.infer<z.ZodObject<typeof checkoutBodyShape>>;

/** Redirects stay on the storefront, and a delivery needs a UK address and a phone. */
function checkCheckoutBody(storefrontOrigin: string) {
  return (body: CheckoutBodyCommon, ctx: z.RefinementCtx) => {
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
  };
}

function normaliseCheckoutPostcode<T extends CheckoutBodyCommon>(body: T): T {
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
}

export function createCheckoutBodySchema(storefrontOrigin: string) {
  return z
    .object({ ...checkoutBodyShape, saveAddress: z.boolean().optional() })
    .superRefine(checkCheckoutBody(storefrontOrigin))
    .transform(normaliseCheckoutPostcode);
}

/** Checkout without an account: the same order details, plus who the guest is. */
export function createGuestCheckoutBodySchema(storefrontOrigin: string) {
  return z
    .object({
      ...checkoutBodyShape,
      email: z.string().trim().min(3).max(254).email(),
      name: z.string().trim().min(1).max(200),
      marketingConsent: z.boolean().optional(),
    })
    .strict()
    .superRefine(checkCheckoutBody(storefrontOrigin))
    .transform(normaliseCheckoutPostcode);
}

export const guestEmailCheckBodySchema = z
  .object({
    email: z.string().trim().min(3).max(254),
    marketingConsent: z.boolean().optional(),
    website: z.string().max(200).optional(),
  })
  .strict();

export const guestOrderLinkResendBodySchema = z
  .object({
    email: z.string().trim().min(3).max(254),
    orderReference: z.string().trim().min(3).max(40),
  })
  .strict();

const guestOrderTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** The shop API's answer to a guest order: the payment page and the order's access token. */
export const guestCheckoutSessionSchema = z.object({
  orderId: z.string().uuid(),
  checkoutUrl: z.string().min(1),
  expiresAt: z.string(),
  orderAccessToken: guestOrderTokenSchema,
  orderAccessExpiresAt: z.string().datetime({ offset: true }),
});

/** Only what the BFF needs from an opened guest order link: its state and expiry. */
export const guestOrderViewStateSchema = z.union([
  z.object({ state: z.literal("valid"), linkExpiresAt: z.string().datetime({ offset: true }) }),
  z.object({ state: z.enum(["expired", "claimed"]) }),
]);

/** Where payment returns to: both pages must be on the storefront. */
export function storefrontRedirectsBodySchema(storefrontOrigin: string) {
  const onStorefront = z
    .string()
    .url()
    .refine((value) => new URL(value).origin === storefrontOrigin, "Must stay on the storefront");
  return z.object({ successUrl: onStorefront, cancelUrl: onStorefront }).strict();
}

export const checkoutBodySchema = createCheckoutBodySchema("http://localhost:3020");

const ENQUIRY_NAME_MAX_LENGTH = 120;
const ENQUIRY_EMAIL_MAX_LENGTH = 254;

/** A blank optional field is the same as an omitted one. */
function optionalText(schema: z.ZodString) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );
}

/**
 * Contact fields shared by artwork and general enquiries. Name and email are optional here
 * because signed-in visitors are identified by their session; `requireGuestContact` makes them
 * mandatory when there is no session. `website` is a honeypot that people never see: it is
 * forwarded so the API can drop the enquiry silently, and bounded so it cannot carry a payload.
 */
const enquiryContactShape = {
  name: optionalText(z.string().trim().min(1).max(ENQUIRY_NAME_MAX_LENGTH)),
  email: optionalText(z.string().trim().max(ENQUIRY_EMAIL_MAX_LENGTH).email()),
  website: optionalText(z.string().max(500)),
};

export const artworkInterestBodySchema = z
  .object({
    intent: z.enum(["notify_me", "enquiry"]).optional(),
    message: optionalText(z.string().trim().min(1).max(2000)),
    contactPhone: optionalText(
      z.string().trim().min(8).max(20).regex(DELIVERY_PHONE_PATTERN, "Enter a valid phone number"),
    ),
    ...enquiryContactShape,
  })
  .strict();

/** "Report a problem" on an order: a reason and what happened. */
export const orderProblemReportBodySchema = z
  .object({
    reason: z.enum(["changed_mind", "damaged", "wrong_item", "not_arrived", "other"]),
    details: z.string().trim().min(1).max(2000),
  })
  .strict();

export const generalEnquiryBodySchema = z
  .object({
    topic: z.enum(["general", "private_viewing", "art_advisory", "selling", "exhibition"]),
    contextSlug: optionalText(z.string().max(120)),
    message: z.string().trim().min(1).max(4000),
    phone: optionalText(z.string().trim().max(40)),
    ...enquiryContactShape,
  })
  .strict();
