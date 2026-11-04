import { describe, expect, it } from "vitest";
import { uploadFailureCopy } from "./upload-failure-copy";

describe("uploadFailureCopy", () => {
  it("speaks of a photo for a seller's work", () => {
    const copy = uploadFailureCopy("submission_image");
    expect(copy.failed("Could not prepare upload")).toBe("This photo didn't upload. Try again");
    expect(copy.tooLarge(10 * 1024 * 1024)).toBe("This photo is over 10 MB. Choose a smaller file");
    expect(copy.wrongType).toBe("This file isn't a photo we can use. Choose a JPG, PNG or WebP");
  });

  it("leaves other uploads with their own words", () => {
    const copy = uploadFailureCopy("lot_image");
    expect(copy.failed("Could not prepare upload")).toBe("Could not prepare upload");
    expect(copy.tooLarge(10 * 1024 * 1024)).toBe("This file is over the 10 MB limit.");
    expect(copy.wrongType).toBe("This file type is not supported.");
  });
});
