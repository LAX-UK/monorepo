import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

describe("renderEmail", () => {
  it("renders kyc-resubmission-required with issue detail", async () => {
    const rendered = await renderEmail("kyc-resubmission-required", {
      userName: "Ada",
      issueDetail: "Face not clearly visible",
      verifyUrl: "https://lax.bid/dashboard/verify-identity",
    });

    expect(rendered.subject).toContain("identity verification");
    expect(rendered.html).toContain("Face not clearly visible");
    expect(rendered.html).toContain("Continue verification");
  });
});
