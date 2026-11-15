import { describe, expect, it } from "vitest";
import { EnquiryReplyAddresses } from "./enquiry-reply-address.js";

const ID = "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11";
const OTHER = "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a12";
const make = (secret = "s".repeat(40)) =>
  new EnquiryReplyAddresses({ baseAddress: "Replies@Inbound.example.test", secret });

describe("EnquiryReplyAddresses", () => {
  it("builds a plus-address on the inbound domain that names one thread", () => {
    const address = make().addressFor(ID);
    expect(address).toMatch(/^replies\+[0-9a-f]{32}-[0-9a-f]{24}@inbound\.example\.test$/);
    expect(make().match({ addresses: [address] })).toEqual({ kind: "valid", enquiryId: ID });
  });

  it("matches case-insensitively and through MailboxHash", () => {
    const address = make().addressFor(ID);
    const hash = address.split("+")[1]?.split("@")[0];
    expect(make().match({ addresses: [address.toUpperCase()] })).toEqual({
      kind: "valid",
      enquiryId: ID,
    });
    expect(make().match({ addresses: ["x@elsewhere.test"], mailboxHash: hash })).toEqual({
      kind: "valid",
      enquiryId: ID,
    });
  });

  it("rejects a forged proof, a proof for another thread and another secret", () => {
    const real = make().addressFor(ID);
    const forged = real.replace(/-[0-9a-f]{24}@/, `-${"0".repeat(24)}@`);
    expect(make().match({ addresses: [forged] })).toEqual({ kind: "invalid" });
    const swapped = make()
      .addressFor(OTHER)
      .replace(/^(.*\+)[0-9a-f]{32}/, `$1${ID.replace(/-/g, "")}`);
    expect(make().match({ addresses: [swapped] })).toEqual({ kind: "invalid" });
    expect(make("t".repeat(40)).match({ addresses: [real] })).toEqual({ kind: "invalid" });
  });

  it("ignores addresses that carry no tag or are on another domain", () => {
    expect(make().match({ addresses: ["replies@inbound.example.test"] })).toEqual({ kind: "none" });
    expect(make().match({ addresses: [make().addressFor(ID).replace("inbound", "evil")] })).toEqual(
      {
        kind: "none",
      },
    );
  });

  it("treats a malformed tag as invalid, not as none", () => {
    expect(make().match({ addresses: ["replies+E-1042@inbound.example.test"] })).toEqual({
      kind: "invalid",
    });
  });
});
