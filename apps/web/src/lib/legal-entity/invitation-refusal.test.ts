import { ORGANISATION_CLOSED_TO_MEMBERS, ORGANISATION_RESTRICTED_MEMBERS } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { invitationRefusalMessage } from "./invitation-refusal";

describe("invitationRefusalMessage", () => {
  it.each([ORGANISATION_RESTRICTED_MEMBERS, ORGANISATION_CLOSED_TO_MEMBERS])(
    "shows the server's message for $code",
    ({ code, message }) => {
      expect(invitationRefusalMessage({ code, error: message })).toBe(message);
      // Without a message in the body, the shared refusal still has the words.
      expect(invitationRefusalMessage({ code })).toBe(message);
    },
  );

  it("never shows a raw code", () => {
    expect(
      invitationRefusalMessage({ error: "invitation_expired", code: "invitation_expired" }),
    ).toBe("This invitation has expired. Ask the person who invited you to send a new one.");
    expect(invitationRefusalMessage({ error: "something_new" })).toBe(
      "We couldn't accept the invitation. Try again in a moment.",
    );
    expect(invitationRefusalMessage(null)).toBe(
      "We couldn't accept the invitation. Try again in a moment.",
    );
  });
});
