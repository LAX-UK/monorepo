import {
  CATALOGUE_WRITE_ACCESS,
  SALE_ADMIN_DETAIL_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";
import { viewerCanSeeNonPublicCatalog } from "@auction/validators";

/** Staff may edit catalogue media and related entities (matches upload presign policy). */
export function canManageCatalogue(role: UserRole, staffRoles?: StaffRoles | undefined): boolean {
  return userHasAccessTo(role, staffRoles, CATALOGUE_WRITE_ACCESS);
}

/** Staff may read catalogue records that are not public yet: editors, and `admin.read`. */
export function canReadCatalogueAdmin(
  role: UserRole,
  staffRoles?: StaffRoles | undefined,
): boolean {
  return viewerCanSeeNonPublicCatalog(role, staffRoles);
}

/** Staff may open a sale's admin record: catalogue readers, and the saleroom clerk's console. */
export function canReadSaleAdminDetail(
  role: UserRole,
  staffRoles?: StaffRoles | undefined,
): boolean {
  return userHasAccessTo(role, staffRoles, SALE_ADMIN_DETAIL_ACCESS);
}
