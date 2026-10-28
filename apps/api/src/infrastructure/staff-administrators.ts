import type {
  ILaxAdminRoleReader,
  IStaffNoticeRecipientReader,
  StaffNoticeRecipient,
} from "@auction/persistence/interfaces";
import type { LaxStaffAccessProduct } from "@auction/types";
import type { IStaffAdministrators } from "../services/staff/staff-role-notices.js";

/**
 * Each admin's administrators as notice recipients: Bid's from its own roster, LAX Admin's from
 * the directory of LAX Admin roles.
 */
export class StaffAdministratorDirectory implements IStaffAdministrators {
  constructor(
    private readonly recipients: IStaffNoticeRecipientReader,
    private readonly laxAdminRoles: Pick<ILaxAdminRoleReader, "listActiveAdministratorIds">,
  ) {}

  async listAdministrators(
    product: LaxStaffAccessProduct,
    now: Date,
  ): Promise<StaffNoticeRecipient[]> {
    if (product === "bid") return this.recipients.listActiveAdministrators(now);
    const ids = await this.laxAdminRoles.listActiveAdministratorIds(now);
    return this.recipients.findByIds(ids);
  }
}
