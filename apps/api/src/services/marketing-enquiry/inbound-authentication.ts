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
};

function first(headers: readonly MailHeader[], name: string): string | undefined {
  const wanted = name.toLowerCase();
  return headers.find((h) => h.Name.toLowerCase() === wanted)?.Value;
}

/** The result word of the topmost `Received-SPF` header, which the receiving server adds. */
export function spfResultOf(headers: readonly MailHeader[]): InboundSpfResult {
  const word =
    first(headers, "Received-SPF")
      ?.trim()
      .toLowerCase()
      .split(/[\s(;]/, 1)[0] ?? "";
  return (INBOUND_SPF_RESULTS as readonly string[]).includes(word)
    ? (word as InboundSpfResult)
    : "none";
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

/** What the receiving server recorded about who sent a mail: its SPF result and aligned DKIM. */
export function inboundAuthentication(
  headers: readonly MailHeader[],
  fromAddress: string,
  options: InboundAuthenticationOptions = {},
): InboundAuthentication {
  return {
    spf: spfResultOf(headers),
    dkim: dkimResultOf(headers, fromAddress, options),
  };
}
