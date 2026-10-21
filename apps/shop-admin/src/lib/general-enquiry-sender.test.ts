import { describe, expect, it } from "vitest";
import { generalEnquirySenderLabel } from "./general-enquiry-sender";

describe("generalEnquirySenderLabel", () => {
  it("shows a guest's typed name and email instead of an account id", () => {
    expect(
      generalEnquirySenderLabel({
        identitySubjectId: null,
        contactName: "Grace Hopper",
        contactEmail: "grace@example.com",
      }),
    ).toBe("Grace Hopper · grace@example.com");
  });

  it("keeps the account id for signed-in senders and adds any contact details", () => {
    expect(
      generalEnquirySenderLabel({
        identitySubjectId: "sub-1",
        contactName: null,
        contactEmail: null,
      }),
    ).toBe("Subject sub-1");
    expect(
      generalEnquirySenderLabel({
        identitySubjectId: "sub-1",
        contactName: "Ada",
        contactEmail: "ada@example.com",
      }),
    ).toBe("Ada · ada@example.com · Subject sub-1");
  });
});
