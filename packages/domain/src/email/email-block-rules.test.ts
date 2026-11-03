import { EMAIL_BLOCK_REASONS } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  EMAIL_BLOCK_RULES,
  emailLiftAccessRefusal,
  emailLiftInputRefusal,
  emailSendStatus,
} from "./email-block-rules.js";

const SUPPORT = { canLift: true, isEmailAdmin: false };
const ADMIN = { canLift: true, isEmailAdmin: true };
const READ_ONLY = { canLift: false, isEmailAdmin: false };

describe("email block rules", () => {
  it("has one row for every block reason", () => {
    expect(Object.keys(EMAIL_BLOCK_RULES).sort()).toEqual([...EMAIL_BLOCK_REASONS].sort());
  });

  it("lets client services and administrators lift bounces and manual blocks", () => {
    for (const reason of ["hard_bounce", "soft_bounce_threshold", "manual"] as const) {
      expect(emailLiftAccessRefusal(reason, SUPPORT)).toBeNull();
      expect(emailLiftAccessRefusal(reason, ADMIN)).toBeNull();
      expect(emailLiftAccessRefusal(reason, READ_ONLY)).toBe("not_allowed");
    }
  });

  it("leaves complaints to administrators only", () => {
    expect(emailLiftAccessRefusal("complaint", SUPPORT)).toBe("administrator_only");
    expect(emailLiftAccessRefusal("complaint", READ_ONLY)).toBe("administrator_only");
    expect(emailLiftAccessRefusal("complaint", ADMIN)).toBeNull();
  });

  it("lets nobody lift an unsubscribe", () => {
    expect(emailLiftAccessRefusal("unsubscribe", ADMIN)).toBe("unsubscribe_not_liftable");
    expect(EMAIL_BLOCK_RULES.unsubscribe.stopsEssentialEmail).toBe(false);
  });

  it("flags only the complaint as a complaint that stays unreactivatable at the provider", () => {
    const complaints = EMAIL_BLOCK_REASONS.filter((r) => EMAIL_BLOCK_RULES[r].isComplaint);
    expect(complaints).toEqual(["complaint"]);
    expect(EMAIL_BLOCK_RULES.complaint.providerReactivation).toBe("unavailable");
  });

  it("requires a note for other, and for every complaint lift", () => {
    expect(emailLiftInputRefusal("hard_bounce", { reason: "mailbox_fixed" })).toBeNull();
    expect(emailLiftInputRefusal("hard_bounce", { reason: "other" })).toBe("note_required");
    expect(emailLiftInputRefusal("hard_bounce", { reason: "other", note: "   " })).toBe(
      "note_required",
    );
    expect(
      emailLiftInputRefusal("hard_bounce", { reason: "other", note: "Phoned the client" }),
    ).toBeNull();
    expect(
      emailLiftInputRefusal("complaint", {
        reason: "asked_to_receive_again",
        writtenRequest: true,
      }),
    ).toBe("note_required");
  });

  it("requires the written request for a complaint", () => {
    expect(
      emailLiftInputRefusal("complaint", {
        reason: "asked_to_receive_again",
        note: "Email of 2 Nov",
      }),
    ).toBe("written_request_required");
    expect(
      emailLiftInputRefusal("complaint", {
        reason: "asked_to_receive_again",
        note: "Email of 2 Nov",
        writtenRequest: true,
      }),
    ).toBeNull();
  });

  it("refuses a reason that does not belong to the block", () => {
    expect(emailLiftInputRefusal("complaint", { reason: "mailbox_fixed", note: "x" })).toBe(
      "reason_not_accepted",
    );
    expect(emailLiftInputRefusal("hard_bounce", { reason: "asked_to_receive_again" })).toBe(
      "reason_not_accepted",
    );
  });
});

describe("email send status", () => {
  const status = (outbox: Parameters<typeof emailSendStatus>[0]["outbox"], ...events: string[]) =>
    emailSendStatus({ outbox, events: new Set(events) });

  it("maps each outbox state and provider report", () => {
    expect(status("pending")).toBe("queued");
    expect(status("sending")).toBe("queued");
    expect(status("failed")).toBe("failed");
    expect(status("suppressed")).toBe("not_sent_blocked");
    expect(status("sent")).toBe("sent");
    expect(status("sent", "soft_bounce")).toBe("sent");
    expect(status("sent", "delivered")).toBe("delivered");
    expect(status("sent", "delivered", "bounce")).toBe("bounced");
    expect(status("sent", "delivered", "bounce", "complaint")).toBe("complaint");
  });
});
