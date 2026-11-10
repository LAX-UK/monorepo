import { VIEWER_ZONE_INIT_SNIPPET } from "@/lib/csp/viewer-zone-init-snippet";

/**
 * Inline script, next to the theme script, that runs before paint: it keeps the `lax_tz` cookie
 * current and marks `<html>` `tz-away` when the visitor's clock differs from London's, so the
 * time chip's row is held before the chip arrives. Like the theme script it is allowed by its
 * static hash (see middleware), which keeps the nonce out of hydration.
 */
export function ViewerZoneInit() {
  return (
    <script
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted inline script for the viewer zone
      dangerouslySetInnerHTML={{ __html: VIEWER_ZONE_INIT_SNIPPET }}
    />
  );
}
