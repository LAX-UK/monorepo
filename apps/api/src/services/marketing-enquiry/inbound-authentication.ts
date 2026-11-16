import {
  INBOUND_SPF_RESULTS,
  type InboundAuthentication,
  type InboundDkimResult,
  type InboundSpfResult,
} from "@auction/domain";

/** One header of a received mail, in the order the mail carries them (newest first). */
export type MailHeader = { Name: string; Value: string };

export type InboundAuthenticationOptions = {
  /**
   * The authserv-id of the receiving server's `Authentication-Results` header. Only that header
   * is believed, and only when it is the topmost one: a sender can write any header into their
   * own mail, but not above the one the receiving server adds. Without it, DKIM counts as `none`.
   */
  trustedAuthservId?: string | undefined;
  /**
   * The domain of the `receiver=` the receiving server writes into its own `Received-SPF` header
   * (Postmark writes `receiver=…@inbound.postmarkapp.com`). Only the topmost `Received-SPF` with
   * that receiver is believed; any other, including one a sender wrote into their own mail,
   * counts as no result. Defaults to Postmark's inbound domain.
   */
  trustedSpfReceiver?: string | undefined;
};

/** The receiver Postmark names in the `Received-SPF` header it adds to inbound mail. */
export const POSTMARK_SPF_RECEIVER = "inbound.postmarkapp.com";

function first(headers: readonly MailHeader[], name: string): string | undefined {
  const wanted = name.toLowerCase();
  return headers.find((h) => h.Name.toLowerCase() === wanted)?.Value;
}

/** The `key=value` pairs after the result in a `Received-SPF` value (RFC 7208 §9.1). */
function spfKeyValues(value: string): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const match of value.matchAll(/(?:^|[\s;])([a-z-]+)\s*=\s*("[^"]*"|[^\s;]+)/gi)) {
    const key = match[1]?.toLowerCase();
    if (key && !pairs.has(key)) pairs.set(key, (match[2] ?? "").replace(/^"|"$/g, "").trim());
  }
  return pairs;
}

/** "abc+x@inbound.postmarkapp.com" or "mx.example.test" → its domain, lower case. */
function receiverDomain(receiver: string): string {
  return (receiver.includes("@") ? domainOfAddress(receiver) : receiver)
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

/**
 * The SPF result of the topmost `Received-SPF` header, believed only when the trusted receiving
 * server wrote it (its `receiver=` is that server's domain), and counted as `pass` only when the
 * domain SPF checked (`envelope-from`, or the HELO name when there is none) aligns with the From
 * domain. A pass for another domain is `pass_unaligned`, which does not authenticate the sender.
 */
export function spfResultOf(
  headers: readonly MailHeader[],
  fromAddress = "",
  options: InboundAuthenticationOptions = {},
): InboundSpfResult {
  const value = first(headers, "Received-SPF")?.trim();
  if (!value) return "none";
  const trusted = (options.trustedSpfReceiver ?? POSTMARK_SPF_RECEIVER)
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  const pairs = spfKeyValues(value);
  const receiver = receiverDomain(pairs.get("receiver") ?? "");
  if (!trusted || !(receiver === trusted || receiver.endsWith(`.${trusted}`))) return "none";
  const word = value.toLowerCase().split(/[\s(;]/, 1)[0] ?? "";
  if (!(INBOUND_SPF_RESULTS as readonly string[]).includes(word)) return "none";
  if (word !== "pass") return word as InboundSpfResult;
  const envelopeFrom = pairs.get("envelope-from") ?? "";
  const checkedDomain = envelopeFrom.includes("@")
    ? domainOfAddress(envelopeFrom.replace(/^</, ""))
    : (pairs.get("helo") ?? "").toLowerCase();
  return domainsAlign(checkedDomain, domainOfAddress(fromAddress)) ? "pass" : "pass_unaligned";
}

/** "Sam <sam@mail.example.test>" → "mail.example.test". */
export function domainOfAddress(address: string): string {
  const at = address.lastIndexOf("@");
  return at < 0
    ? ""
    : address
        .slice(at + 1)
        .trim()
        .replace(/>$/, "")
        .toLowerCase();
}

/**
 * Relaxed alignment (as DMARC uses it): the signing domain is the From domain, or one is a
 * subdomain of the other. A single-label domain ("com") never aligns.
 */
export function domainsAlign(signingDomain: string, fromDomain: string): boolean {
  const d = signingDomain.trim().toLowerCase().replace(/\.$/, "");
  const f = fromDomain.trim().toLowerCase().replace(/\.$/, "");
  if (!d.includes(".") || !f.includes(".")) return false;
  return d === f || f.endsWith(`.${d}`) || d.endsWith(`.${f}`);
}

type DkimVerdict = { result: string; domain: string };

/** The `dkim=` results of one `Authentication-Results` value (RFC 8601), with their header.d. */
function dkimVerdicts(value: string): DkimVerdict[] {
  return value
    .split(";")
    .slice(1)
    .map((part) => part.trim())
    .filter((part) => /^dkim\s*=/i.test(part))
    .map((part) => ({
      result: /^dkim\s*=\s*([a-z]+)/i.exec(part)?.[1]?.toLowerCase() ?? "",
      domain: /\bheader\.d\s*=\s*([^\s;]+)/i.exec(part)?.[1]?.toLowerCase() ?? "",
    }));
}

/** The DKIM result, from the topmost `Authentication-Results` header of the trusted server. */
export function dkimResultOf(
  headers: readonly MailHeader[],
  fromAddress: string,
  options: InboundAuthenticationOptions,
): InboundDkimResult {
  const trusted = options.trustedAuthservId?.trim().toLowerCase();
  const value = first(headers, "Authentication-Results");
  if (!trusted || !value) return "none";
  const authservId = value.split(";", 1)[0]?.trim().split(/\s+/, 1)[0]?.toLowerCase();
  if (authservId !== trusted) return "none";
  const verdicts = dkimVerdicts(value);
  const fromDomain = domainOfAddress(fromAddress);
  const passed = verdicts.filter((v) => v.result === "pass");
  if (passed.some((v) => domainsAlign(v.domain, fromDomain))) return "pass";
  if (passed.length > 0) return "pass_unaligned";
  return verdicts.some((v) => v.result !== "none" && v.result !== "") ? "fail" : "none";
}

/** What the receiving server recorded about who sent a mail: aligned SPF and aligned DKIM. */
export function inboundAuthentication(
  headers: readonly MailHeader[],
  fromAddress: string,
  options: InboundAuthenticationOptions = {},
): InboundAuthentication {
  return {
    spf: spfResultOf(headers, fromAddress, options),
    dkim: dkimResultOf(headers, fromAddress, options),
  };
}
