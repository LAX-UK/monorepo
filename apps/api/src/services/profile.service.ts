import type {
  IProfileReader,
  IProfileWriter,
  ProfileUpdateInput,
} from "@auction/persistence/interfaces";
import type { ImageCleanupService } from "./image-cleanup.service.js";

export class ProfileService {
  constructor(
    private readonly reader: IProfileReader,
    private readonly writer: IProfileWriter,
    private readonly imageCleanup?: ImageCleanupService,
  ) {}

  getProfile(userId: string) {
    return this.reader.getProfile(userId);
  }

  async updateProfile(userId: string, input: ProfileUpdateInput) {
    const previous = input.image !== undefined ? await this.reader.getProfile(userId) : null;
    await this.writer.updateProfile(userId, input);
    if (input.image !== undefined) {
      await this.imageCleanup?.enqueueRemoved(previous?.image ?? null, input.image ?? null);
    }
  }
}
