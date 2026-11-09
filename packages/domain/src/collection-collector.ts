/** Who comes to collect: the buyer, a named member of their organisation, or a third party. */
export type CollectorKind = "self" | "member" | "third_party";

export type CollectorInput = {
  kind: CollectorKind;
  /** As it appears on their photo ID. */
  name: string;
  email?: string | null | undefined;
  company?: string | null | undefined;
  /** For a third party: the buyer ticked the written authorisation. */
  authorised?: boolean | undefined;
};

export type CollectorIssue =
  | { field: "name"; code: "name_required" }
  | { field: "email"; code: "email_invalid" }
  | { field: "authorisation"; code: "authorisation_required" };

export type Collector = {
  kind: CollectorKind;
  name: string;
  email: string | null;
  company: string | null;
  /** Whether the booking records a written authorisation by the account holder. */
  authorised: boolean;
};

export type CollectorResult =
  | { ok: true; collector: Collector }
  | { ok: false; issues: CollectorIssue[] };

/**
 * The version of the collection policy a third party's authorisation is recorded against. It
 * changes when the authorisation wording on the booking page does, so every authorisation says
 * which words the account holder agreed to.
 */
export const COLLECTION_AUTHORISATION_POLICY_VERSION = "2026-11";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 120;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
};

/**
 * Checks and tidies who is collecting. Every collector needs the name on their photo ID. A third
 * party also needs the account holder's authorisation, which is the written authorisation the
 * collection policy asks for; their email is optional and, when given, must look like one.
 */
export function resolveCollector(input: CollectorInput): CollectorResult {
  const name = clean(input.name);
  const email = clean(input.email);
  const issues: CollectorIssue[] = [];
  if (!name || name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    issues.push({ field: "name", code: "name_required" });
  }
  if (email !== null && !EMAIL.test(email)) issues.push({ field: "email", code: "email_invalid" });
  const isThirdParty = input.kind === "third_party";
  if (isThirdParty && input.authorised !== true) {
    issues.push({ field: "authorisation", code: "authorisation_required" });
  }
  if (issues.length > 0 || name === null) return { ok: false, issues };
  return {
    ok: true,
    collector: {
      kind: input.kind,
      name,
      email,
      company: isThirdParty ? clean(input.company) : null,
      authorised: isThirdParty,
    },
  };
}

/** Whether the collector is emailed their own copy of the details (never with prices). */
export function collectorGetsOwnEmail(collector: Pick<Collector, "kind" | "email">): boolean {
  return collector.kind === "third_party" && collector.email !== null;
}
