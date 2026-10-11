export const ENQUIRY_MESSAGE_MAX_LENGTH = 2000;
export const ENQUIRY_PHONE_MAX_LENGTH = 40;

const E164 = /^\+[1-9]\d{7,14}$/;

export type EnquiryFormInput = {
  message?: unknown;
  contactPhone?: unknown;
};

export type EnquiryFormField = "message" | "contactPhone";

export type EnquiryPayload = {
  intent: "enquiry";
  message?: string;
  contactPhone?: string;
};

export type EnquiryValidationResult =
  | { ok: true; payload: EnquiryPayload }
  | { ok: false; fieldErrors: Partial<Record<EnquiryFormField, string>> };

/** “+44 (0)20 7946-0958” → “+442079460958”; “0044…” → “+44…”. */
export function normalizeEnquiryPhone(raw: string): string {
  const compact = raw
    .trim()
    .replace(/\(0\)/g, "")
    .replace(/[\s().-]/g, "");
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function validateEnquiryForm(input: EnquiryFormInput): EnquiryValidationResult {
  const fieldErrors: Partial<Record<EnquiryFormField, string>> = {};
  const message = readText(input.message).trim();
  const rawPhone = readText(input.contactPhone).trim();
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
      ...(message ? { message } : {}),
      ...(contactPhone ? { contactPhone } : {}),
    },
  };
}
