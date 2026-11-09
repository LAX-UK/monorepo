import { createInventoryPeerClient } from "@auction/artwork-register-contracts";
import type { createDb } from "@auction/db";
import {
  DrizzleZohoListingLock,
  DrizzleZohoListingRunStore,
  DrizzleZohoListingSourceReader,
} from "@auction/persistence/repositories";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { ShopApiLaxArtListings } from "../integrations/zoho/artwork/listing/lax-art-listings.js";
import { ListingLinks } from "../integrations/zoho/artwork/listing/listing-links.js";
import { CrmZohoListingProducts } from "../integrations/zoho/artwork/listing/zoho-listing-products.js";
import { ZohoListingReconcile } from "../integrations/zoho/artwork/listing/zoho-listing-reconcile.js";
import { ZohoListingSaleStartPass } from "../integrations/zoho/artwork/listing/zoho-listing-sale-start.js";
import { ZohoListingSync } from "../integrations/zoho/artwork/listing/zoho-listing-sync.js";
import { ZohoListingWriteback } from "../integrations/zoho/artwork/listing/zoho-listing-writeback.js";
import { createZohoCrmBatchStack } from "../integrations/zoho/create-zoho-crm-gateway.js";

export type ZohoArtworkListingRuntime = {
  writeback: ZohoListingWriteback;
  /** The nightly pass that corrects drift. */
  reconcile: ZohoListingReconcile;
  /** The frequent pass for sales that have just started on their own time. */
  saleStart: ZohoListingSaleStartPass;
};

/**
 * Builds the LAX listing on Zoho Products. With the mode off nothing is built, so neither Zoho nor
 * LAX Shop is ever called. The environment schema makes every setting required otherwise.
 */
export function createZohoArtworkListing(deps: {
  env: WorkerEnv;
  db: ReturnType<typeof createDb>;
  log: Logger;
}): ZohoArtworkListingRuntime | undefined {
  const { env, db, log } = deps;
  const mode = env.ZOHO_ARTWORK_LISTING_MODE;
  if (mode === "off") return undefined;
  const {
    SHOP_API_INVENTORY_BASE_URL: shopUrl,
    INVENTORY_MACHINE_CLIENT_ID: clientId,
    INVENTORY_MACHINE_CLIENT_SECRET: clientSecret,
    LAX_ART_PUBLIC_URL: artPublicUrl,
    LAX_ADMIN_PUBLIC_URL: laxAdminUrl,
  } = env;
  if (!shopUrl || !clientId || !clientSecret || !artPublicUrl || !laxAdminUrl) {
    throw new Error("zoho_artwork_listing_not_configured");
  }

  const sources = new DrizzleZohoListingSourceReader(db);
  const sync = new ZohoListingSync({
    mode,
    sources,
    laxArt: new ShopApiLaxArtListings(
      createInventoryPeerClient({ baseUrl: shopUrl, clientId, clientSecret }),
    ),
    products: new CrmZohoListingProducts(createZohoCrmBatchStack(env)),
    lock: new DrizzleZohoListingLock(db),
    links: new ListingLinks({ artPublicUrl, laxAdminUrl, bidPublicUrl: env.WEB_ORIGIN }),
    log,
  });
  return {
    writeback: new ZohoListingWriteback({ sync, sources, mode }),
    reconcile: new ZohoListingReconcile({
      mode,
      sync,
      sources,
      runs: new DrizzleZohoListingRunStore(db),
      log,
    }),
    saleStart: new ZohoListingSaleStartPass({ sync, sources, log }),
  };
}
