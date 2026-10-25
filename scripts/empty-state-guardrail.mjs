/**
 * Empty states use the shared component and illustration set (docs/DESIGN_SYSTEM.md): EmptyState
 * from @auction/ui, MarketingStatusState (through each product's wrapper) or the staff-ui states,
 * all drawing from LaxIllustration. Three regressions are caught:
 *   - a list that says "No … yet" in a bare paragraph instead of an empty state;
 *   - an empty state given a small icon instead of an illustration;
 *   - an app drawing its own *Illustration SVG instead of adding to the shared set.
 */

export const EMPTY_STATE_APPS = ["web", "shop", "art", "account", "shop-admin"];

/**
 * Text that reads like an empty state but is not one: hints inside form repeaters, live console
 * feeds that must stay one line tall, and a metric value. Paths are relative to the repo root.
 */
export const INLINE_EMPTY_TEXT_ALLOWED = new Set([
  "apps/web/src/components/admin/artist-form/artist-preview.tsx",
  "apps/web/src/components/admin/lot-marketing-form/steps/catalog-step.tsx",
  "apps/web/src/components/admin/sale-form/sale-lot-rows-editor.tsx",
  "apps/web/src/components/dashboard/submission-wizard/steps/provenance-step.tsx",
  "apps/web/src/components/sections/artwork/onsite/live-bid-feed.tsx",
  "apps/web/src/features/saleroom/components/clerk-console/display-control-panel.tsx",
  "apps/web/src/features/saleroom/components/clerk-console/lot-runway-panel.tsx",
  "apps/account/src/components/portfolio-header.tsx",
]);

const BARE_EMPTY_PARAGRAPH = /<p\b[^>]*>\s*(?:No|Nothing)\b[^<{]*\byet\b[^<{]*<\/p>/;
const EMPTY_STATE_ICON =
  /<(?:EmptyState|DashboardEmptyState|AdminEmptyState|MarketingEmptyState)\b[^<>]*?\bicon=\{</;
const LOCAL_ILLUSTRATION = /function \w+Illustration\b[^{]*\{[\s\S]*?<svg\b/;

/** @returns {string[]} one message per broken rule in `text` (the source of file `rel`). */
export function checkEmptyStateSource(rel, text) {
  const violations = [];
  if (BARE_EMPTY_PARAGRAPH.test(text) && !INLINE_EMPTY_TEXT_ALLOWED.has(rel)) {
    violations.push(
      `${rel}: bare "No … yet" paragraph — use EmptyState (size="compact" in tables and panels)`,
    );
  }
  if (EMPTY_STATE_ICON.test(text)) {
    violations.push(
      `${rel}: empty state with an icon — pass illustration="…" from LaxIllustration`,
    );
  }
  if (LOCAL_ILLUSTRATION.test(text)) {
    violations.push(
      `${rel}: local illustration SVG — add the drawing to packages/ui lax-illustration.tsx`,
    );
  }
  return violations;
}
