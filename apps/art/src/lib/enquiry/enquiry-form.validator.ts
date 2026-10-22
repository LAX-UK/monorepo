export const ENQUIRY_MESSAGE_MAX_LENGTH = 2000;
export const ENQUIRY_PHONE_MAX_LENGTH = 40;
export const ENQUIRY_NAME_MAX_LENGTH = 120;
/** 254 is the SMTP path limit for an address; the API enforces the same bound. */
export const ENQUIRY_EMAIL_MAX_LENGTH = 254;

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EnquiryFormInput = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  contactPhone?: unknown;
};

export type EnquiryFormField = "name" | "email" | "contactPhone" | "message";
export type EnquiryFieldErrors = Partial<Record<EnquiryFormField, string>>;

export type EnquiryPayload = {
  intent: "enquiry";
  name: string;
  email: string;
  message?: string;
  contactPhone?: string;
};

export type EnquiryValidationResult =
  | { ok: true; payload: EnquiryPayload }
  | { ok: false; fieldErrors: EnquiryFieldErrors };

/** “+44 (0)20 7946-0958” → “+442079460958”; “0044…” → “+44…”. */
export function normalizeEnquiryPhone(raw: string): string {
  const compact = raw
    .trim()
    .replace(/\(0\)/g, "")
    .replace(/[\s().-]/g, "");
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
}

export function readEnquiryText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function validateEnquiryName(value: unknown): string | null {
  const name = readEnquiryText(value).trim();
  if (!name) return "Enter your name.";
  if (name.length > ENQUIRY_NAME_MAX_LENGTH) {
    return `Keep your name under ${ENQUIRY_NAME_MAX_LENGTH} characters.`;
  }
  return null;
}

export function validateEnquiryEmail(value: unknown): string | null {
  const email = readEnquiryText(value).trim();
  if (!email) return "Enter your email address.";
  if (email.length > ENQUIRY_EMAIL_MAX_LENGTH || !EMAIL.test(email)) {
    return "Enter a valid email address, for example name@example.com.";
  }
  return null;
}

/** Name and email are how the gallery replies, so every enquiry needs both. */
export function validateEnquiryContact(input: EnquiryFormInput): EnquiryFieldErrors {
  const errors: EnquiryFieldErrors = {};
  const name = validateEnquiryName(input.name);
  const email = validateEnquiryEmail(input.email);
  if (name) errors.name = name;
  if (email) errors.email = email;
  return errors;
}

export function validateEnquiryForm(input: EnquiryFormInput): EnquiryValidationResult {
  const fieldErrors = validateEnquiryContact(input);
  const message = readEnquiryText(input.message).trim();
  const rawPhone = readEnquiryText(input.contactPhone).trim();
  const contactPhone = rawPhone ? normalizeEnquiryPhone(rawPhone) : "";

  if (message.length > ENQUIRY_MESSAGE_MAX_LENGTH) {
    fieldErrors.message = `Keep your message under ${ENQUIRY_MESSAGE_MAX_LENGTH} characters.`;
  }
  if (rawPhone && (rawPhone.length > ENQUIRY_PHONE_MAX_LENGTH || !E164.test(contactPhone))) {
    fieldErrors.contactPhone =
      "Enter a phone number with country code, for example +44 20 7946 0958.";
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    payload: {
      intent: "enquiry",
      name: readEnquiryText(input.name).trim(),
      email: readEnquiryText(input.email).trim(),
      ...(message ? { message } : {}),
      ...(contactPhone ? { contactPhone } : {}),
    },
  };
}
