import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import { toObjectRecord } from "@/lib/data/http/object-guards";
import { z } from "zod";

const addressTypeSchema = z.enum(["shipping", "billing", "both"]);

export const profileAddressRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): ProfileAddressRow => {
    const addressType = addressTypeSchema.safeParse(row.addressType);
    return {
      id: String(row.id ?? ""),
      label: String(row.label ?? ""),
      line1: String(row.line1 ?? ""),
      line2: row.line2 == null ? null : String(row.line2),
      city: String(row.city ?? ""),
      state: row.state == null ? null : String(row.state),
      postalCode: String(row.postalCode ?? ""),
      country: String(row.country ?? ""),
      addressType: addressType.success ? addressType.data : "both",
      isDefault: Boolean(row.isDefault),
    };
  }) as z.ZodType<ProfileAddressRow>;
