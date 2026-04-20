import type { NewAddressFormValues, ProfileDisplayNameFormValues } from "./profile-settings-schema";

export function profileNameToFormData(values: ProfileDisplayNameFormValues): FormData {
  const fd = new FormData();
  fd.set("name", values.name.trim());
  return fd;
}

export function newAddressToFormData(values: NewAddressFormValues): FormData {
  const fd = new FormData();
  fd.set("label", values.label.trim());
  fd.set("line1", values.line1.trim());
  fd.set("line2", values.line2.trim());
  fd.set("city", values.city.trim());
  fd.set("state", values.state.trim());
  fd.set("postalCode", values.postalCode.trim());
  fd.set("country", values.country.trim());
  if (values.isDefault) fd.set("isDefault", "on");
  return fd;
}
