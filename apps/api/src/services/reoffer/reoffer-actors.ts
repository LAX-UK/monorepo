import type { StaffRoles, UserRole } from "@auction/types";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";

/** A member of LAX staff acting from the admin screens. */
export type ReofferStaffActor = {
  userId: string;
  role: UserRole;
  staffRoles: StaffRoles | undefined;
};

/** A member of the seller's or the bidder's account acting from their workspace. */
export type ReofferMemberActor = OrganisationMemberActor;
