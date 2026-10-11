import { ART_THEME_INIT_SNIPPET } from "@/lib/theme/art-theme";

/** Inline bootstrap so `html.dark` is set before first paint. */
export function ArtThemeInit() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static theme bootstrap, no user input
      dangerouslySetInnerHTML={{ __html: ART_THEME_INIT_SNIPPET }}
    />
  );
}
