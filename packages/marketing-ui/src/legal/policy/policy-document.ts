import { type LaxOperatedProduct, legalEntityFacts, legalEntityFor } from "@auction/branding";

/**
 * A policy page written in code: plain strings with three inline marks, parsed by
 * `parseLegalPolicyText`:
 * - `[label](/href)` a link (site paths, full URLs or `#anchor`)
 * - `**text**` strong emphasis
 * - `[TO CONFIRM: what is needed]` a placeholder the owner or lawyer must fill before approval
 */
export type LegalPolicyText = string;

export type LegalPolicyBlock =
  | { type: "paragraph"; text: LegalPolicyText }
  | { type: "subheading"; text: string }
  | { type: "list"; items: readonly LegalPolicyText[]; ordered?: boolean }
  | {
      type: "table";
      caption: string;
      columns: readonly string[];
      rows: readonly (readonly LegalPolicyText[])[];
    }
  /** A boxed passage, such as the model cancellation form. */
  | { type: "panel"; title: string; blocks: readonly LegalPolicyBlock[] }
  /** The registered details of the company that runs the product, as on every LAX legal page. */
  | { type: "company"; product: LaxOperatedProduct };

export type LegalPolicySection = {
  /** Anchor id: lowercase words joined by hyphens. */
  id: string;
  heading: string;
  blocks: readonly LegalPolicyBlock[];
};

export type LegalPolicyDocument<Slug extends string = string> = {
  slug: Slug;
  title: string;
  /** Meta description. */
  summary: string;
  /** Opening paragraph under the title, when the page has one. */
  lead?: LegalPolicyText;
  sections: readonly LegalPolicySection[];
};

export type LegalPolicyStatus = "draft" | "approved";

/**
 * Release state of a policy page. A page moves to "approved" only after legal review, with every
 * `[TO CONFIRM: …]` placeholder filled. Bump `version` and `lastUpdated` with every wording change.
 */
export type LegalPolicyRelease = {
  status: LegalPolicyStatus;
  version: string;
  /** ISO date (YYYY-MM-DD) of the last wording change. */
  lastUpdated: string;
  /** How the date is introduced; "Last updated" unless the policy says otherwise. */
  dateLabel?: string;
};

export type LegalPolicyVisibility = "published" | "draft-preview" | "hidden";

/** Approved pages publish everywhere; drafts show with a banner off production and 404 on it. */
export function resolveLegalPolicyVisibility(
  release: LegalPolicyRelease,
  production: boolean,
): LegalPolicyVisibility {
  if (release.status === "approved") return "published";
  return production ? "hidden" : "draft-preview";
}

/** `*_DEPLOY_ENV` is set from the image build's environment ("test" or "prod"). */
export function isProductionDeployEnv(deployEnv: string | undefined): boolean {
  const value = deployEnv?.trim().toLowerCase();
  return value === "prod" || value === "production";
}

export type LegalPolicyTextPart =
  | { kind: "text"; value: string }
  | { kind: "strong"; value: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "placeholder"; value: string };

const INLINE_MARK = /\[TO CONFIRM: ([^\]]+)\]|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
const PLACEHOLDER = /\[TO CONFIRM: ([^\]]+)\]/g;

export function parseLegalPolicyText(text: LegalPolicyText): LegalPolicyTextPart[] {
  const parts: LegalPolicyTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE_MARK)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ kind: "text", value: text.slice(cursor, index) });
    const [whole, placeholder, label, href, strong] = match;
    if (placeholder !== undefined) parts.push({ kind: "placeholder", value: placeholder });
    else if (label !== undefined && href !== undefined) parts.push({ kind: "link", label, href });
    else if (strong !== undefined) parts.push({ kind: "strong", value: strong });
    cursor = index + whole.length;
  }
  if (cursor < text.length) parts.push({ kind: "text", value: text.slice(cursor) });
  return parts;
}

function blockTexts(block: LegalPolicyBlock): string[] {
  switch (block.type) {
    case "paragraph":
    case "subheading":
      return [block.text];
    case "list":
      return [...block.items];
    case "table":
      return [block.caption, ...block.columns, ...block.rows.flat()];
    case "panel":
      return [block.title, ...block.blocks.flatMap(blockTexts)];
    case "company":
      return Object.values(legalEntityFacts(legalEntityFor(block.product))).filter(
        (fact): fact is string => fact !== null,
      );
  }
}

/** Every string in the document, in reading order. */
export function legalPolicyTexts(document: LegalPolicyDocument): string[] {
  return [
    document.title,
    document.summary,
    ...(document.lead ? [document.lead] : []),
    ...document.sections.flatMap((section) => [
      section.heading,
      ...section.blocks.flatMap(blockTexts),
    ]),
  ];
}

/** The `[TO CONFIRM: …]` placeholders still to fill, in reading order. */
export function legalPolicyPlaceholders(document: LegalPolicyDocument): string[] {
  return legalPolicyTexts(document).flatMap((text) =>
    [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? ""),
  );
}
