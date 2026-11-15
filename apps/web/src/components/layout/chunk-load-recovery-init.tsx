import { CHUNK_LOAD_RECOVERY_SNIPPET } from "@/lib/csp/chunk-load-recovery-snippet.client";

/**
 * Inline script that reloads a page left open across a deploy once its JavaScript or CSS files
 * have gone (see the snippet). Allowed by its static hash like the theme script.
 */
export function ChunkLoadRecoveryInit() {
  return (
    <script
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted inline script for chunk-load recovery
      dangerouslySetInnerHTML={{ __html: CHUNK_LOAD_RECOVERY_SNIPPET }}
    />
  );
}
