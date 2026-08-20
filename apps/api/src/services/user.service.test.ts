import type { IUserRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { UserService } from "./user.service.js";

describe("UserService account deletion", () => {
  it("delegates the state change and durable event to Identity", async () => {
    const markDeletionRequested = vi.fn(async () => undefined);
    const service = new UserService({} as IUserRepository, { markDeletionRequested });

    await service.requestAccountDeletion("subject-1");

    expect(markDeletionRequested).toHaveBeenCalledOnce();
    expect(markDeletionRequested).toHaveBeenCalledWith("subject-1");
  });
});
