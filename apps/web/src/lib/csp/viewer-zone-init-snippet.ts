import { buildViewerZoneScript } from "@auction/datetime";

/** Inline viewer-zone bootstrap; must match bytes in ViewerZoneInit and the CSP hash in middleware. */
export const VIEWER_ZONE_INIT_SNIPPET = buildViewerZoneScript();
