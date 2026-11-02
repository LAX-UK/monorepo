import type { IUserRepository } from "@auction/persistence/interfaces";

/** Who may be given an enquiry. */
export interface IEnquiryAssigneeDirectory {
  isStaff(userId: string): Promise<boolean>;
}

/** Staff are the users whose account role is `staff`. */
export class UserRepositoryAssigneeDirectory implements IEnquiryAssigneeDirectory {
  constructor(private readonly users: Pick<IUserRepository, "findById">) {}

  async isStaff(userId: string): Promise<boolean> {
    return (await this.users.findById(userId))?.role === "staff";
  }
}
