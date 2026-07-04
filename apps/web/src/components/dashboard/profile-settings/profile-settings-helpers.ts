export function emailStatusLabel(
  status: string | undefined,
  verified: boolean | undefined,
): string {
  if (status === "bounced") return "Bounced";
  if (status === "complained") return "Complained";
  if (verified === false) return "Unverified";
  return "Verified";
}

export function emailStatusVariant(
  status: string | undefined,
  verified: boolean | undefined,
): "success" | "danger" | "warning" {
  if (status === "bounced" || status === "complained") return "danger";
  if (verified === false) return "warning";
  return "success";
}

export function addressTypeTags(a: {
  isDefault: boolean;
  addressType: string;
}): { key: string; label: string }[] {
  const tags: { key: string; label: string }[] = [];
  if (a.isDefault) tags.push({ key: "default", label: "Default" });
  if (a.addressType === "both") tags.push({ key: "both", label: "Billing & shipping" });
  else if (a.addressType === "billing") tags.push({ key: "bill", label: "Billing" });
  else tags.push({ key: "ship", label: "Shipping" });
  return tags;
}
