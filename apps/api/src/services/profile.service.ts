import type { IProfileReader, IProfileWriter, ProfileUpdateInput } from "./interfaces/profile.js";

export class ProfileService {
  constructor(
    private readonly reader: IProfileReader,
    private readonly writer: IProfileWriter,
  ) {}

  getProfile(userId: string) {
    return this.reader.getProfile(userId);
  }

  updateProfile(userId: string, input: ProfileUpdateInput) {
    return this.writer.updateProfile(userId, input);
  }
}
