/**
 * Which files must build on `@auction/staff-ui` instead of the public-site `@auction/ui` controls.
 *
 * - Bid admin: every file under app/admin and components/admin, for `@auction/ui/components/*`.
 * - LAX Admin: every source file, for any `@auction/ui` import (the package root and its
 *   subpaths). Tests are exempt, since they stub the primitives the kit is built on.
 */
const BID_ADMIN_DIRS = ["app/admin", "components/admin"];

const RULES = {
  web: {
    pattern: /["']@auction\/ui\/components\/[^"']+["']/,
    applies: (rel) => BID_ADMIN_DIRS.some((dir) => rel.startsWith(`${dir}/`)),
    message: "imports @auction/ui/components — build admin screens with @auction/staff-ui",
  },
  "shop-admin": {
    pattern: /["']@auction\/ui(?:\/[^"']*)?["']/,
    applies: (rel) => !/\.test\.tsx?$/.test(rel) && !rel.startsWith("test/"),
    message: "imports @auction/ui — build LAX Admin screens with @auction/staff-ui",
  },
};

/**
 * The violation message for one source file, or null when it is allowed.
 * @param {"web" | "shop-admin"} app
 * @param {string} rel path relative to the app's src directory
 * @param {string} text file contents
 */
export function legacyUiViolation(app, rel, text) {
  const rule = RULES[app];
  if (!rule?.applies(rel) || !rule.pattern.test(text)) return null;
  return rule.message;
}
