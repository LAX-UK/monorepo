import { describe, expect, it, vi } from "vitest";
import { ProfileService } from "./profile.service.js";

describe("ProfileService", () => {
  it("updates profile image to null and enqueues cleanup for previous owned image", async () => {
    const reader = {
      getProfile: vi.fn().mockResolvedValue({
        id: "u1",
        email: "u1@example.com",
        name: "User",
        image: "uploads/pending/avatar/u1/old.webp",
        role: "client",
      }),
    };
    const writer = { updateProfile: vi.fn().mockResolvedValue(undefined) };
    const cleanup = { enqueueRemoved: vi.fn().mockResolvedValue(undefined) };
    const service = new ProfileService(reader, writer, cleanup as never);

    await service.updateProfile("u1", { image: null });

    expect(writer.updateProfile).toHaveBeenCalledWith("u1", { image: null });
    expect(cleanup.enqueueRemoved).toHaveBeenCalledWith("uploads/pending/avatar/u1/old.webp", null);
  });

  it("does not read the previous profile when only the name changes", async () => {
    const reader = { getProfile: vi.fn() };
    const writer = { updateProfile: vi.fn().mockResolvedValue(undefined) };
    const cleanup = { enqueueRemoved: vi.fn() };
    const service = new ProfileService(reader, writer, cleanup as never);

    await service.updateProfile("u1", { name: "New Name" });

    expect(reader.getProfile).not.toHaveBeenCalled();
    expect(cleanup.enqueueRemoved).not.toHaveBeenCalled();
  });
});
