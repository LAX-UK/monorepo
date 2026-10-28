import type { Database } from "@auction/db";
import type { ShopStaffRole } from "@auction/shop-domain";
import {
  type ShopStaffRosterOutcome,
  ShopStaffRosterService,
} from "../application/admin/shop-staff-roster.service.js";
import { createDrizzleShopStaffRoster } from "./drizzle-shop-staff-roster.js";

/** LAX Admin's roster on `db` (a transaction when the caller holds one). */
export function shopStaffRosterOn(db: Database): ShopStaffRosterService {
  return new ShopStaffRosterService(createDrizzleShopStaffRoster(db));
}

/**
 * Gives a person a LAX Admin role, for the ops CLI and seeds. Roles they already hold stay: the
 * role is added, with the same rules as every other change.
 */
export function grantShopStaffRole(
  db: Database,
  input: { subject: string; role: ShopStaffRole; operatorSubjectId: string; reason?: string },
): Promise<ShopStaffRosterOutcome> {
  return shopStaffRosterOn(db).assign({
    subjectId: input.subject,
    role: input.role,
    endsAt: null,
    actorSubjectId: input.operatorSubjectId,
    reason: input.reason ?? null,
    eventId: null,
  });
}
