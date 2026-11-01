/**
 * Which files must build on the LAX kit (`@auction/ui/lax`) instead of the older `@auction/ui`
 * elements that Shop, lax.art and LAX Account still share.
 *
 * Applies to Bid's public site: the marketing routes, the marketing and section components, the
 * bid components and the header chrome. Rejects the older Button, Badge, Alert, Tabs and Input,
 * whether imported from their own path or from the package root. Tests are exempt.
 */
const PUBLIC_PREFIXES = [
  "app/(marketing)/",
  "components/marketing/",
  "components/sections/",
  "components/bid/",
];
const PUBLIC_FILES = new Set([
  "components/layout/header-auth-chip.tsx",
  "components/layout/header-search.tsx",
  "components/layout/header-user-menu.tsx",
  "components/layout/notification-bell.tsx",
  "components/layout/logout-button.tsx",
]);
/** The signed-in checkout belongs to the client workspace, not the public site. */
const EXEMPT_PREFIXES = ["components/sections/checkout/"];

/** The older element and its kit replacement, by the name it is imported under. */
export const OLDER_ELEMENTS = {
  Button: "Button from @auction/ui/lax",
  Badge: "StatusBadge or Count from @auction/ui/lax",
  Alert: "Notice from @auction/ui/lax",
  Tabs: "TabNav from @auction/ui/lax",
  Input: "Field with TextInput from @auction/ui/lax",
};

const MODULE_PATHS = {
  "@auction/ui/components/button": "Button",
  "@auction/ui/components/badge": "Badge",
  "@auction/ui/components/alert": "Alert",
  "@auction/ui/components/tabs": "Tabs",
  "@auction/ui/components/input": "Input",
};
const ROOT_NAMES = {
  Button: "Button",
  Badge: "Badge",
  Alert: "Alert",
  Tabs: "Tabs",
  Input: "Input",
};

export function isPublicFile(rel) {
  if (/\.test\.tsx?$/.test(rel)) return false;
  if (EXEMPT_PREFIXES.some((p) => rel.startsWith(p))) return false;
  return PUBLIC_FILES.has(rel) || PUBLIC_PREFIXES.some((p) => rel.startsWith(p));
}

/**
 * The older elements a public file imports, as a sorted list of element names ("Button", ...).
 * @param {string} rel path relative to apps/web/src
 * @param {string} text file contents
 */
export function olderElementsImported(rel, text) {
  if (!isPublicFile(rel)) return [];
  const found = new Set();
  for (const match of text.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g,
  )) {
    const [, names, from] = match;
    if (from in MODULE_PATHS) {
      const element = MODULE_PATHS[from];
      const imported = names.split(",").map(
        (n) =>
          n
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0],
      );
      if (imported.some((n) => n.startsWith(element) || n === "buttonVariants")) found.add(element);
    } else if (from === "@auction/ui") {
      for (const n of names.split(",").map(
        (x) =>
          x
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0],
      )) {
        if (n in ROOT_NAMES) found.add(ROOT_NAMES[n]);
        if (n === "buttonVariants") found.add("Button");
      }
    }
  }
  return [...found].sort();
}
