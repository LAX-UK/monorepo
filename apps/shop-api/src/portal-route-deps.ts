import type {
  PortalOwnershipReader,
  PortalSalesReader,
} from "./application/ports/portal-ownership.reader.js";

export type PortalRoutesDeps = {
  portalOwnership: PortalOwnershipReader;
  portalSales: PortalSalesReader;
};
