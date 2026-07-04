import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import type { createAddressBodySchema } from "@auction/validators";
import type { z } from "zod";

export type AddressFormValues = z.infer<typeof createAddressBodySchema>;

export const emptyAddress: AddressFormValues = {
  label: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United Kingdom",
  addressType: "both",
  isDefault: false,
};

export function addressToForm(address: ProfileAddressRow): AddressFormValues {
  return {
    label: address.label,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state ?? "",
    postalCode: address.postalCode,
    country: address.country,
    addressType: address.addressType,
    isDefault: address.isDefault,
  };
}

export function normalizeAddress(values: AddressFormValues): AddressFormValues {
  return {
    label: values.label.trim(),
    line1: values.line1.trim(),
    line2: values.line2?.trim() || undefined,
    city: values.city.trim(),
    state: values.state?.trim() || undefined,
    postalCode: values.postalCode.trim(),
    country: values.country.trim(),
    addressType: values.addressType ?? "both",
    isDefault: values.isDefault ?? false,
  };
}
