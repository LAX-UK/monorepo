import { domainToASCII } from "node:url";

/** Zoho's Leads and Contacts `Email` field holds at most this many characters. */
export const CRM_EMAIL_MAX_LENGTH = 100;
/** The longest local part (before the `@`) mail standards allow (RFC 5321 §4.5.3.1.1). */
export const CRM_EMAIL_LOCAL_PART_MAX_LENGTH = 64;

/** Why an address cannot be sent to the CRM. Never holds the address itself. */
export type CrmEmailProblem =
  | "missing"
  | "too_long"
  | "local_part_too_long"
  | "invalid_local_part"
  | "invalid_domain";

export type CrmEmailCheck = { ok: true; email: string } | { ok: false; problem: CrmEmailProblem };

/** Plain ASCII dot-atom: the local parts every mail system, Zoho included, takes. */
const LOCAL_PART = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TOP_LEVEL_DOMAIN = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/**
 * The address as the CRM is sent it: surrounding spaces removed, the domain in lower case and in
 * its ASCII form, so an address Zoho can store is never refused over its spelling. An address
 * Zoho cannot store (too long, a local part over 64 characters, characters outside plain ASCII
 * before the `@`) is reported with the reason instead, so it is not sent and refused again.
 */
export function prepareCrmEmail(raw: string | null | undefined): CrmEmailCheck {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, problem: "missing" };
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return { ok: false, problem: "invalid_local_part" };

  const local = trimmed.slice(0, at);
  if (local.length > CRM_EMAIL_LOCAL_PART_MAX_LENGTH) {
    return { ok: false, problem: "local_part_too_long" };
  }
  if (!LOCAL_PART.test(local)) return { ok: false, problem: "invalid_local_part" };

  const domain = asciiDomain(trimmed.slice(at + 1));
  if (!domain) return { ok: false, problem: "invalid_domain" };

  const email = `${local}@${domain}`;
  if (email.length > CRM_EMAIL_MAX_LENGTH) return { ok: false, problem: "too_long" };
  return { ok: true, email };
}

function asciiDomain(raw: string): string | null {
  const lower = raw.toLowerCase().replace(/\.$/, "");
  if (!lower || /\s/.test(lower)) return null;
  const ascii = domainToASCII(lower);
  if (!ascii) return null;
  const labels = ascii.split(".");
  if (labels.length < 2) return null;
  if (!labels.every((label) => DOMAIN_LABEL.test(label))) return null;
  return TOP_LEVEL_DOMAIN.test(labels[labels.length - 1] ?? "") ? ascii : null;
}
