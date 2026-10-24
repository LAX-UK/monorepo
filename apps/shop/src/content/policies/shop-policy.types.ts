import type { ShopPolicySlug } from "./shop-policy-status";

/**
 * Policy text is plain strings with three inline marks, parsed by `parseShopPolicyText`:
 * - `[label](/href)` a link (site paths or `#anchor`)
 * - `**text**` strong emphasis
 * - `[TO CONFIRM: what is needed]` a placeholder the owner or lawyer must fill before approval
 */
export type ShopPolicyText = string;

export type ShopPolicyBlock =
  | { type: "paragraph"; text: ShopPolicyText }
  | { type: "subheading"; text: string }
  | { type: "list"; items: readonly ShopPolicyText[]; ordered?: boolean }
  | {
      type: "table";
      caption: string;
      columns: readonly string[];
      rows: readonly (readonly ShopPolicyText[])[];
    }
  /** A boxed passage, such as the model cancellation form. */
  | { type: "panel"; title: string; blocks: readonly ShopPolicyBlock[] };

export type ShopPolicySection = {
  /** Anchor id: lowercase words joined by hyphens. */
  id: string;
  heading: string;
  blocks: readonly ShopPolicyBlock[];
};

export type ShopPolicyDocument = {
  slug: ShopPolicySlug;
  title: string;
  /** Meta description and the lead paragraph under the title. */
  summary: string;
  sections: readonly ShopPolicySection[];
};
