import { SHOP_STAFF_ROLES, type ShopStaffRole } from "@auction/shop-domain";

/** LAX Admin's role names as staff read them; the same names Bid admin uses for these roles. */
const ROLE_LABELS: Record<ShopStaffRole, string> = {
  shop_admin: "Administrator",
  account_manager: "Account manager",
  broker: "Broker",
  operations: "Operations",
  finance: "Finance",
  catalogue_editor: "Catalogue editor",
  editor: "Editor",
  read_only: "Read-only",
};

function isShopStaffRole(role: string): role is ShopStaffRole {
  return (SHOP_STAFF_ROLES as readonly string[]).includes(role);
}

/** "account_manager" becomes "Account manager": the role as staff read it. */
export function staffRoleLabel(role: string): string {
  if (isShopStaffRole(role)) return ROLE_LABELS[role];
  const spaced = role.replaceAll("_", " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Several roles in role order, as one label: "Catalogue editor, Editor". */
export function staffRolesLabel(roles: readonly string[]): string {
  const order = (role: string) => {
    const index = (SHOP_STAFF_ROLES as readonly string[]).indexOf(role);
    return index === -1 ? SHOP_STAFF_ROLES.length : index;
  };
  return [...new Set(roles)]
    .sort((a, b) => order(a) - order(b))
    .map(staffRoleLabel)
    .join(", ");
}
