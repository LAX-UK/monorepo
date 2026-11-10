import { INLINE_HEAD_SCRIPTS } from "@/lib/csp/inline-head-scripts";
import { THEME_INIT_SNIPPET } from "@/lib/csp/theme-init-snippet";
import { VIEWER_ZONE_INIT_SNIPPET } from "@/lib/csp/viewer-zone-init-snippet";
import { describe, expect, it } from "vitest";

describe("INLINE_HEAD_SCRIPTS", () => {
  it("lists the theme and viewer-zone scripts the layout inlines, so the CSP hashes both", () => {
    expect(INLINE_HEAD_SCRIPTS).toEqual([THEME_INIT_SNIPPET, VIEWER_ZONE_INIT_SNIPPET]);
  });

  it("keeps the viewer-zone script free of a nonce-dependent byte", () => {
    expect(VIEWER_ZONE_INIT_SNIPPET).toContain('"lax_tz"');
    expect(VIEWER_ZONE_INIT_SNIPPET).toContain('"tz-away"');
  });
});
