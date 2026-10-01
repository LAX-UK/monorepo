import type { PortalOwnershipReader } from "./application/ports/portal-ownership.reader.js";

export type PortalRoutesDeps = {
  portalOwnership: PortalOwnershipReader;
};
