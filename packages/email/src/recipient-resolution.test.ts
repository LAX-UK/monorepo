import { describe, expect, it } from "vitest";
import { RECIPIENT_RESOLUTION } from "./types.js";

describe("RECIPIENT_RESOLUTION", () => {
  it("snapshots invite recipients because invitees are not registered users yet", () => {
    expect(RECIPIENT_RESOLUTION.invite).toBe("snapshot");
  });
});
