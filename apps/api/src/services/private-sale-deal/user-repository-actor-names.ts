import type { IUserRepository } from "@auction/persistence/interfaces";
import type { DealActorNames } from "./deal-desk.service.js";

/** Names staff for a deal's timeline from the user records. */
export class UserRepositoryActorNames implements DealActorNames {
  constructor(private readonly users: Pick<IUserRepository, "findById">) {}

  async namesOf(userIds: readonly string[]): Promise<Map<string, string>> {
    const found = await Promise.all(userIds.map((id) => this.users.findById(id)));
    return new Map(found.flatMap((user) => (user ? [[user.id, user.name] as const] : [])));
  }
}
