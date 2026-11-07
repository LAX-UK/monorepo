import { describe, expect, it } from "vitest";
import { enquiryErasureBlock } from "./data-requests.js";

describe("enquiryErasureBlock", () => {
  it("allows only a manual request in progress", () => {
    expect(enquiryErasureBlock({ kind: "manual", status: "in_progress" })).toBeNull();
  });

  it("blocks a download whatever its status", () => {
    for (const status of ["ready", "delayed", "failed", "collecting"]) {
      expect(enquiryErasureBlock({ kind: "download", status })).toBe("download");
    }
  });

  it("blocks a manual request waiting for ID or closed", () => {
    expect(enquiryErasureBlock({ kind: "manual", status: "waiting_for_id" })).toBe(
      "waiting_for_id",
    );
    expect(enquiryErasureBlock({ kind: "manual", status: "closed" })).toBe("closed");
  });
});
