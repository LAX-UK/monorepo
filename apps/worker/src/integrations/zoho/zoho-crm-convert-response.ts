import { z } from "zod";

const convertLeadResponseSchema = z.object({
  data: z
    .array(
      z.object({
        Contacts: z.union([z.string(), z.object({ id: z.string().optional() })]).optional(),
        details: z
          .object({
            Contacts: z.object({ id: z.string() }).optional(),
            id: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export function parseConvertLeadContactId(httpStatus: number, bodyText: string): string {
  let json: unknown;
  try {
    json = JSON.parse(bodyText) as unknown;
  } catch {
    throw new Error(`convert_lead_invalid_json:${httpStatus}`);
  }
  const parsed = convertLeadResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("convert_lead_unrecognized_shape");
  }
  const row = parsed.data.data?.[0];
  const fromDetails = row?.details?.Contacts?.id ?? row?.details?.id;
  if (fromDetails) return fromDetails;
  const contacts = row?.Contacts;
  if (typeof contacts === "string") return contacts;
  if (contacts && typeof contacts === "object" && contacts.id) return contacts.id;
  throw new Error("convert_lead_missing_contact_id");
}
