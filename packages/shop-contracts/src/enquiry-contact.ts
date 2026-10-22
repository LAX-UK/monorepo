import { Type } from "@sinclair/typebox";

/** Same bounds as the storefront enquiry forms; 254 is the SMTP path limit for an address. */
export const ENQUIRY_CONTACT_NAME_MAX_LENGTH = 120;
export const ENQUIRY_CONTACT_EMAIL_MAX_LENGTH = 254;

/**
 * Contact fields shared by artwork and general enquiries.
 *
 * `name` and `email` are required for guest (BFF-authenticated) requests and optional for
 * signed-in ones, where they record the details the buyer chose to send. `website` is a
 * honeypot that people never see: when it is non-empty the API answers as if it stored the
 * enquiry and drops it.
 */
export const EnquiryContactProperties = {
  name: Type.Optional(
    Type.String({ minLength: 1, maxLength: ENQUIRY_CONTACT_NAME_MAX_LENGTH, pattern: "\\S" }),
  ),
  email: Type.Optional(
    Type.String({ format: "email", maxLength: ENQUIRY_CONTACT_EMAIL_MAX_LENGTH }),
  ),
  website: Type.Optional(Type.String({ maxLength: 500 })),
};
