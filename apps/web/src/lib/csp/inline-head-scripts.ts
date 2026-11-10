import { THEME_INIT_SNIPPET } from "@/lib/csp/theme-init-snippet";
import { VIEWER_ZONE_INIT_SNIPPET } from "@/lib/csp/viewer-zone-init-snippet";

/** Every inline script the root layout puts in `<head>`; the CSP allows each by its hash. */
export const INLINE_HEAD_SCRIPTS: readonly string[] = [
  THEME_INIT_SNIPPET,
  VIEWER_ZONE_INIT_SNIPPET,
];
