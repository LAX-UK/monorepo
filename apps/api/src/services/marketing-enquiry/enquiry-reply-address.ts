import { createHmac, timingSafeEqual } from "node:crypto";

const TAG = /^([0-9a-f]{32})-([0-9a-f]{24})$/;

export type ReplyAddressMatch =
  /** No address names a thread. */
  | { kind: "none" }
  /** An address has a thread tag whose proof does not check out. */
  | { kind: "invalid" }
  | { kind: "valid"; enquiryId: string };

function toUuid(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The reply address of one enquiry thread: `<mailbox>+<thread id>-<proof>@<inbound domain>`. The
 * proof is an HMAC of the thread id under a server secret, so the address cannot be made up from
 * an enquiry reference or id, and a leaked address names one thread only.
 */
export class EnquiryReplyAddresses {
  private readonly mailbox: string;
  private readonly domain: string;
  private readonly key: Buffer;

  constructor(options: { baseAddress: string; secret: string }) {
    const at = options.baseAddress.lastIndexOf("@");
    if (at < 1) throw new Error("ENQUIRY_REPLY_TO_ADDRESS must be an email address");
    this.mailbox = options.baseAddress.slice(0, at).toLowerCase();
    this.domain = options.baseAddress.slice(at + 1).toLowerCase();
    this.key = createHmac("sha256", options.secret).update("enquiry-reply-address:v1").digest();
  }

  private proof(idHex: string): string {
    return createHmac("sha256", this.key).update(idHex).digest("hex").slice(0, 24);
  }

  addressFor(enquiryId: string): string {
    const idHex = enquiryId.replace(/-/g, "").toLowerCase();
    return `${this.mailbox}+${idHex}-${this.proof(idHex)}@${this.domain}`;
  }

  /** Reads the thread out of the recipient addresses (and Postmark's MailboxHash) of one mail. */
  match(input: {
    addresses: readonly string[];
    mailboxHash?: string | undefined;
  }): ReplyAddressMatch {
    const tags: string[] = [];
    for (const raw of input.addresses) {
      const address = raw.trim().toLowerCase();
      const at = address.lastIndexOf("@");
      if (at < 1 || address.slice(at + 1) !== this.domain) continue;
      const local = address.slice(0, at);
      const prefix = `${this.mailbox}+`;
      if (local.startsWith(prefix)) tags.push(local.slice(prefix.length));
    }
    if (input.mailboxHash && tags.length === 0) tags.push(input.mailboxHash.toLowerCase());
    if (tags.length === 0) return { kind: "none" };
    let sawInvalid = false;
    for (const tag of tags) {
      const parts = TAG.exec(tag);
      if (!parts) {
        sawInvalid = true;
        continue;
      }
      const [, idHex = "", given = ""] = parts;
      const expected = Buffer.from(this.proof(idHex));
      const got = Buffer.from(given);
      if (got.length === expected.length && timingSafeEqual(got, expected)) {
        return { kind: "valid", enquiryId: toUuid(idHex) };
      }
      sawInvalid = true;
    }
    return sawInvalid ? { kind: "invalid" } : { kind: "none" };
  }
}
