import type { IUserRepository } from "@auction/persistence/interfaces";

/** A staff member an enquiry may be given to. */
export type EnquiryAssignee = { id: string; name: string };

/** Who may be given an enquiry. */
export interface IEnquiryAssigneeDirectory {
  isStaff(userId: string): Promise<boolean>;
  /** Everyone an enquiry may be given to, by name. */
  list(): Promise<EnquiryAssignee[]>;
}

/** Staff are the users whose account role is `staff`. */
export class UserRepositoryAssigneeDirectory implements IEnquiryAssigneeDirectory {
  constructor(private readonly users: Pick<IUserRepository, "findById" | "listIdsByRole">) {}

  async isStaff(userId: string): Promise<boolean> {
    return (await this.users.findById(userId))?.role === "staff";
  }

  async list(): Promise<EnquiryAssignee[]> {
    const ids = await this.users.listIdsByRole("staff");
    const people = await Promise.all(ids.map((id) => this.users.findById(id)));
    return people
      .flatMap((person) => (person?.role === "staff" ? [{ id: person.id, name: person.name }] : []))
      .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  }
}
