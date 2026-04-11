import type { IUserRepository } from "./interfaces/repositories.js";

export class UserService {
  constructor(private readonly users: IUserRepository) {}

  getById(id: string) {
    return this.users.findById(id);
  }
}
