import {
  LAX_STAFF_PLATFORMS,
  type LaxStaffAccessProduct,
  laxStaffRoleOption,
} from "@auction/types";

export type StaffPlatformBadge = { product: LaxStaffAccessProduct; label: string };

export function staffRoleOnPlatformLabel(product: LaxStaffAccessProduct, role: string): string {
  return laxStaffRoleOption(product, role)?.label ?? role.replaceAll("_", " ");
}

/** One badge per platform the person can use, in catalogue order. */
export function staffPlatformBadges(
  platforms: readonly { product: LaxStaffAccessProduct; role: string }[],
): StaffPlatformBadge[] {
  return LAX_STAFF_PLATFORMS.flatMap((platform) => {
    const held = platforms.find((p) => p.product === platform.product);
    return held
      ? [
          {
            product: platform.product,
            label: `${platform.label} · ${staffRoleOnPlatformLabel(platform.product, held.role)}`,
          },
        ]
      : [];
  });
}

export function twoFactorStatusLabel(enabled: boolean | null | undefined): string {
  if (enabled == null) return "Unknown";
  return enabled ? "On" : "Off";
}
